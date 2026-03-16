process.on('SIGTERM', function () {
  console.log('SIGTERM received');
  process.exit(0);
});

console.log('pid: ' + process.pid);

// timer, to keep process running
setInterval(function () {
  // keep alive
}, 1000);
