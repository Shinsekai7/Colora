import fc from 'fast-check';

// Run property tests more thoroughly with e.g. `FC_NUM_RUNS=10000 pnpm test`
const numRuns = Number(process.env.FC_NUM_RUNS);

if (numRuns > 0) {
    fc.configureGlobal({numRuns});
}
