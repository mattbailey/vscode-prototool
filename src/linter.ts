import * as cp from "child_process";
import * as path from "path";
import * as vscode from "vscode";

interface LinterErrorRange {
  start: number;
  end: number;
}

export interface LinterError {
  line: number;
  reason: string;
  range: LinterErrorRange;
}

interface LinterHandler {
  (errors: LinterError[]): void;
}

export interface LinterOptions {
  didOpen: boolean;
  languageId: string;
}

export default class Linter {
  config: any;
  constructor(config: any) {
    this.config = config;
  }
  private exec(command: string) {
    return new Promise(function(resolve, reject) {
      cp.exec(
        command,
        {},
        (err: cp.ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => {
          if (!err) {
            resolve(stdout);
            return;
          }
          reject(stdout);
        }
      );
    });
  }

  private buildLinterError(textLine: vscode.TextLine, error: any): LinterError | null {
    vscode.window.showInformationMessage(error.message);
    const { message, lint_id } = error;
    // This will be error-prone in detecting the correct column.
    // We have to find the REAL column to change from the file itself...
    // Reason: https://github.com/uber/prototool/issues/411
    const word = message.split(/\"/)[1];
    const start = textLine.text.indexOf(word);
    return {
      line: textLine.lineNumber,
      range: {
        start,
        end: start + word.length
      },
      reason: `${lint_id}: ${message}`
    };
  }

  private parseErrors(
    document: vscode.TextDocument,
    filePath: string,
    errorStr: string
  ): LinterError[] {
    let errors = errorStr.split("\n").slice(0, -2) || [];
    return errors.reduce((acc: any, errorString: any) => {
      const error = JSON.parse(errorString);
      const textLine = document.lineAt(error.line - 1);
      const parsedError = this.buildLinterError(textLine, error);
      return !parsedError ? acc : acc.concat(parsedError);
    }, []);
  }

  public lint(
    document: vscode.TextDocument,
    fileName: string,
    options: LinterOptions,
    handler: LinterHandler | null = null
  ): void {
    const opts: LinterOptions = Object.assign(
      {},
      {
        didOpen: false,
        languageId: "proto"
      },
      options
    );

    const isProtoFile = options.languageId.includes("proto");

    if (opts.didOpen && !isProtoFile) {
      return;
    }

    if (!opts.didOpen && !isProtoFile) {
      return;
    }

    const dirname = path.dirname(fileName);
    const filename = path.basename(fileName);
    const cmd = this.config.docker.use
      ? `docker run --rm -v ${dirname}:/${this.config.docker.volume} ${
          this.config.docker.image
        } lint --json ${this.config.lint.flags} ${filename}`
      : `${this.config.prototool.path} --json lint ${this.config.lint.flags} ${filename}`;

    // TODO: detect when command does not exist
    console.log(`[vscode-prototool] Lint Command: ${cmd}`);
    const result = this.exec(cmd);

    if (handler) {
      result
        .then(() => handler([]))
        .catch(error => handler(this.parseErrors(document, fileName, error)));
    }
  }
}
