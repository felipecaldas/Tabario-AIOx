export function parseArgs(argv) {
  const result = {
    command: '',
    target: '',
    runtime: '',
    json: false,
    verbose: false
  };

  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--json') {
      result.json = true;
      continue;
    }

    if (token === '--verbose' || token === '-v') {
      result.verbose = true;
      continue;
    }

    if (token === '--target' || token === '-t') {
      result.target = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (token === '--runtime' || token === '-r') {
      result.runtime = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (token === '--help' || token === '-h') {
      result.command = 'help';
      continue;
    }

    positional.push(token);
  }

  result.command = positional[0] ?? result.command ?? 'help';
  return result;
}
