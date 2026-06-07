export const log = {
  stage: (n, title) => console.log(`\n── Stage ${n}: ${title}`),
  info:  (s) => console.log(`   ${s}`),
  ok:    (s) => console.log(`   ✓ ${s}`),
  warn:  (s) => console.log(`   ! ${s}`),
  fail:  (s) => console.log(`   ✗ ${s}`),
  done:  (s) => console.log(`\n${s}`),
};
