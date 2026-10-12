const COLUMN_X = [0, 1, 3, 4, 5];

export function seatPosition(seatNumber) {
  const seat = Number(seatNumber);
  if (!Number.isInteger(seat) || seat < 1 || seat > 30) {
    throw new Error("자리 번호는 1번부터 30번까지여야 합니다.");
  }
  const index = seat - 1;
  return { row: Math.floor(index / 5), x: COLUMN_X[index % 5] };
}

export function seatDistance(firstSeat, secondSeat) {
  const first = seatPosition(firstSeat);
  const second = seatPosition(secondSeat);
  return Math.abs(first.row - second.row) + Math.abs(first.x - second.x);
}

export function proximityGroupSizes(count, minSize, maxSize) {
  if (!Number.isInteger(count) || count < 1) throw new Error("배치된 학생이 없습니다.");
  if (!Number.isInteger(minSize) || !Number.isInteger(maxSize) || minSize < 2 || maxSize > 10 || minSize > maxSize) {
    throw new Error("최소 인원은 2명 이상, 최대 인원은 10명 이하로 설정해주세요.");
  }
  const groupCount = Math.ceil(count / maxSize);
  if (count < groupCount * minSize) {
    throw new Error(`${count}명은 ${minSize}~${maxSize}명 조로 빠짐없이 나눌 수 없습니다.`);
  }
  const baseSize = Math.floor(count / groupCount);
  const largerGroups = count % groupCount;
  return Array.from({ length: groupCount }, (_, index) => baseSize + (index < largerGroups ? 1 : 0));
}

function groupScore(members) {
  let score = 0;
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      score += seatDistance(members[i].seatNumber, members[j].seatNumber);
    }
  }
  return score;
}

function totalScore(groups) {
  return groups.reduce((sum, group) => sum + groupScore(group), 0);
}

function groupSpread(members) {
  let spread = 0;
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      spread = Math.max(spread, seatDistance(members[i].seatNumber, members[j].seatNumber));
    }
  }
  return spread;
}

function arrangementScore(groups) {
  const widestGroup = Math.max(...groups.map(groupSpread));
  return widestGroup * 100000 + totalScore(groups);
}

function isolatedSeed(remaining) {
  return [...remaining].sort((left, right) => {
    const leftNearest = Math.min(...remaining.filter(item => item !== left).map(item => seatDistance(left.seatNumber, item.seatNumber)), 99);
    const rightNearest = Math.min(...remaining.filter(item => item !== right).map(item => seatDistance(right.seatNumber, item.seatNumber)), 99);
    return rightNearest - leftNearest || left.seatNumber - right.seatNumber;
  })[0];
}

function greedyGroups(items, sizes, firstSeed) {
  const remaining = [...items];
  const groups = [];
  sizes.forEach((size, groupIndex) => {
    const seed = groupIndex === 0
      ? remaining.find(item => item.seatNumber === firstSeed.seatNumber)
      : isolatedSeed(remaining);
    const members = [seed];
    remaining.splice(remaining.indexOf(seed), 1);
    while (members.length < size) {
      const next = [...remaining].sort((left, right) => {
        const leftCost = members.reduce((sum, member) => sum + seatDistance(left.seatNumber, member.seatNumber), 0);
        const rightCost = members.reduce((sum, member) => sum + seatDistance(right.seatNumber, member.seatNumber), 0);
        return leftCost - rightCost || left.seatNumber - right.seatNumber;
      })[0];
      members.push(next);
      remaining.splice(remaining.indexOf(next), 1);
    }
    groups.push(members);
  });
  return groups;
}

function improveBySwapping(groups) {
  let improved = true;
  while (improved) {
    improved = false;
    outer: for (let firstGroup = 0; firstGroup < groups.length; firstGroup += 1) {
      for (let secondGroup = firstGroup + 1; secondGroup < groups.length; secondGroup += 1) {
        for (let firstIndex = 0; firstIndex < groups[firstGroup].length; firstIndex += 1) {
          for (let secondIndex = 0; secondIndex < groups[secondGroup].length; secondIndex += 1) {
            const before = arrangementScore(groups);
            [groups[firstGroup][firstIndex], groups[secondGroup][secondIndex]] = [groups[secondGroup][secondIndex], groups[firstGroup][firstIndex]];
            const after = arrangementScore(groups);
            if (after < before) {
              improved = true;
              break outer;
            }
            [groups[firstGroup][firstIndex], groups[secondGroup][secondIndex]] = [groups[secondGroup][secondIndex], groups[firstGroup][firstIndex]];
          }
        }
      }
    }
  }
  return groups;
}

export function createProximityGroups(assignment, minSize, maxSize) {
  if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) throw new Error("현재 자리표를 확인해주세요.");
  const items = Object.entries(assignment).map(([seatNumber, studentName]) => ({
    seatNumber: Number(seatNumber),
    studentName: String(studentName ?? "").trim(),
  })).filter(item => item.studentName).sort((left, right) => left.seatNumber - right.seatNumber);
  items.forEach(item => seatPosition(item.seatNumber));
  if (new Set(items.map(item => item.studentName)).size !== items.length) throw new Error("자리표에 중복된 학생이 있습니다.");
  const sizes = proximityGroupSizes(items.length, minSize, maxSize);
  const sizeOrders = sizes.every(size => size === sizes[0]) ? [sizes] : [sizes, [...sizes].reverse()];
  let bestGroups = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const sizeOrder of sizeOrders) {
    for (const seed of items) {
      const candidate = improveBySwapping(greedyGroups(items, sizeOrder, seed));
      const score = arrangementScore(candidate);
      if (score < bestScore) {
        bestScore = score;
        bestGroups = candidate.map(group => [...group]);
      }
    }
  }
  return bestGroups
    .map(members => members.sort((left, right) => left.seatNumber - right.seatNumber))
    .sort((left, right) => left[0].seatNumber - right[0].seatNumber)
    .map((members, index) => ({ groupNo: index + 1, members }));
}
