import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";

export default function formatter(
  document: vscode.TextDocument,
  root: string,
  config: any
): vscode.TextEdit[] {
  const filename = path.relative(root, document.fileName);

  const cmd = config.docker.use
    ? `docker run --rm -v ${root}:${config.docker.volume} ${config.docker.image} format ${filename}`
    : `${config.prototool.path} format ${filename}`;

  let output;
  try {
    output = cp.execSync(cmd, { cwd: root });
  } catch (e) {
    output = e.stdout;
  }

  let start = new vscode.Position(0, 0);
  let end = new vscode.Position(document.lineCount, 0);
  let range = new vscode.Range(start, end);
  return [vscode.TextEdit.replace(range, output.toString())];
}
