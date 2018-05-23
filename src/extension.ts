// The module 'vscode' contains the VS Code extensibility API
// Import the necessary extensibility types to use in your code below
import { ExtensionContext } from 'vscode';
import LintingProvider from './LintingProvider';

// This method is called when your extension is activated. Activation is
// controlled by the activation events defined in package.json.
export function activate(context: ExtensionContext) {
    console.log('Extension "ZsLint" is now active!');

    let linter = new LintingProvider();

    linter.activate(context.subscriptions);
}