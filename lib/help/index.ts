import fs = require('fs');
import path = require('path');
import supportsColor = require('supports-color');

const highlight: string = supportsColor.stdout ? '\x1B[$1m' : '';

function help(item?: string | boolean): string {
  if (!item) {
    item = 'help';
  } else if (item === true) { // if used with -h or --help and no args
    item = 'help';
  }

  // cleanse the filename to only contain letters
  // aka: /\W/g but figured this was eaiser to read
  item = (item as string).replace(/[^a-z]/gi, '');

  try {
    const dir: string = path.join(__dirname, '..', '..', 'doc', 'cli', item + '.txt');
    const body: string = fs.readFileSync(dir, 'utf8');
    return body.replace(/\\x1B\[(.)m/g, highlight);
  } catch (e: unknown) {
    return '"' + item + '" help can\'t be found';
  }
}

export = help;
