import test from 'node:test';
import assert from 'node:assert/strict';
import { reversedRewardIds } from '../domain/xp-reversal-view.ts';

test('a linked counterbooking marks only the original grant as reversed', () => {
  const ledger = [
    {id:'award:1',kind:'grant',amount:3},
    {id:'award:2',kind:'grant',amount:2},
    {id:'c1',kind:'correction',amount:-3,referenceId:'award:1'},
  ];
  assert.deepEqual([...reversedRewardIds(ledger)], ['award:1']);
});

test('ordinary corrections and purchases do not reverse an award', () => {
  const ledger = [
    {id:'award:1',kind:'grant',amount:3},
    {id:'c1',kind:'correction',amount:-1},
    {id:'purchase',kind:'spend',amount:2,referenceId:'award:1'},
  ];
  assert.equal(reversedRewardIds(ledger).size,0);
});
