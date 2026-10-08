import { expect, it } from 'vitest';
import { computeDigests } from './digests.ts';

it('writes the Node digests the lab compares the browser against', async () => {
  // Regenerate with `pnpm test -u` after an intended geometry change; the core's
  // own snapshots will need updating in the same commit.
  await expect(`${JSON.stringify(computeDigests(), null, 2)}\n`).toMatchFileSnapshot(
    './expected-digests.json',
  );
});
