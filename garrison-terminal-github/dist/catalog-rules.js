// Rules from the V3_1 client snapshot and the season's in-game opening tutorial.
export function purchasePrice(operator, training, elite=false) {
  if (operator.hidden) return null;
  const profile=training[String(operator.tier)]?.find(row=>row.isGolden===elite);
  const current=operator[elite?'elite':'normal'];
  // SERVER_CHESS_PRICE's blackboard stores a reduction, not the resulting price.
  const override=current.garrison.some(row=>row.effectType==='SERVER_CHESS_PRICE')
    ? current.trait.match(/购买价格为\s*(\d+)/) : null;
  return override ? Number(override[1]) : profile?.purchasePrice ?? null;
}

export function banReason(operator, banned, byBond) {
  const memberships=operator.normal.bonds.map(id=>byBond.get(id)).filter(Boolean);
  if(memberships.some(b=>b.core&&banned.has(b.bondId)))return 'core';
  // Absolute Art is shared by all elite units, never an individual pool restriction.
  const additional=memberships.filter(b=>!b.core&&!b.noSelect);
  if(additional.length&&additional.every(b=>banned.has(b.bondId)))return 'additional';
  return null;
}
