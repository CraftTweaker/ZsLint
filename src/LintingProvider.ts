import * as vscode from 'vscode';
import * as WebSocket from "ws";
import { Disposable } from 'vscode';


function replaceAll(value: string, search: string, replace: string) {
    return value.replace(new RegExp('[' + search + ']', 'g'), replace);
}

export default class LintingProvider {
    private _disposable!: vscode.Disposable;
    private socket!: WebSocket;
    private diagnosticCollection!: vscode.DiagnosticCollection;

    public activate(subscriptions: vscode.Disposable[]) {
        subscriptions.push(this);

        this.diagnosticCollection = vscode.languages.createDiagnosticCollection();

        let disp: Disposable[] = [];
        // vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => this.doZSLint(event.document), this, disp);
        vscode.workspace.onDidSaveTextDocument(this.doZSLint, this, disp);

        this._disposable = Disposable.from(...disp);
        this.socket = new WebSocket("ws://127.0.0.1:24532", "zslint");

        console.log("ZsLintingPlugin now activated");
    }


    public dispose(): void {
        this._disposable.dispose();
        this.socket.close();
    }


    private doZSLint(textDocument: vscode.TextDocument) {
        if (textDocument.languageId !== 'zenscript') {
            return;
        }

        if (this.socket.OPEN !== this.socket.readyState) {
            console.log("Socket is closed, trying to open new one.");
            this.socket = new WebSocket("ws://127.0.0.1:24532", "zslint");

            this.socket.onopen = (event: { target: WebSocket }) => { this.startSocketCom(event.target); };
        } else {
            this.startSocketCom(this.socket);
        }


    }

    private startSocketCom(s: WebSocket) {
        let m = {
            messageType: "LintRequest"
        };

        let rootDir: string = vscode.workspace.workspaceFolders !== undefined ? vscode.workspace.workspaceFolders[0].uri.path : "";
        rootDir = rootDir.substr(1) + "/";
        console.log("root: " + rootDir);


        this.socket.send(JSON.stringify(m));

        this.socket.onmessage = (event: { data: WebSocket.Data; type: string; target: WebSocket }) => {
            console.log("Received message: " + event.data + " of type: " + event.type);

            let diagnostics: { diagnostic: vscode.Diagnostic, fileName: string }[] = [];


            let obj = JSON.parse(event.data as string);

            if (obj.messageType === "LintResponse") {
                let lintRes = obj as ILintResponse;

                lintRes.errors.forEach(element => {
                    let range = new vscode.Range(element.line - 1, element.offset - 1, element.line - 1, element.offset + 3);
                    let severity = (element.level === "ERROR") ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
                    let diagnostic = new vscode.Diagnostic(range, element.explanation, severity);
                    let fileName = element.fileName;
                    diagnostics.push({ diagnostic, fileName });
                });

                vscode.workspace.textDocuments.forEach(element => {
                    let ds: vscode.Diagnostic[] = [];
                    diagnostics.forEach(diag => {
                        const fileName1 = replaceAll(element.fileName, "\\\\", "/");
                        const fileName2 = rootDir + replaceAll(replaceAll(diag.fileName, "\\\\", "/"), "\/\/", "/");

                        console.log("filename1: " + fileName1);
                        console.log("filename2: " + fileName2);

                        if (fileName1 === fileName2) {
                            ds.push(diag.diagnostic);
                        }
                    });

                    this.diagnosticCollection.set(element.uri, ds);
                });

            }
        };
    }
}

interface ILintResponse {
    errors: {
        fileName: string;
        line: number;
        offset: number;
        explanation: string;
        level: "ERROR" | "INFO" | "WARN";
    }[];
    loadSuccessful: boolean;
    messageType: "LintResponse";
}