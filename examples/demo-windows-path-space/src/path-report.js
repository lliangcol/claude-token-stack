console.log(JSON.stringify({
  cwd: process.cwd(),
  hasSpace: process.cwd().includes(" ")
}, null, 2));
