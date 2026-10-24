const tierPriority = [
  ['opus', 3],
  ['sonnet', 2],
  ['haiku', 1],
]

function versionParts(value) {
  return (value.match(/\d+/g) || []).map(Number)
}

function compareVersionsDescending(left, right) {
  const leftParts = versionParts(left.id)
  const rightParts = versionParts(right.id)
  const length = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const difference = (rightParts[index] || 0) - (leftParts[index] || 0)
    if (difference) return difference
  }

  return left.id.localeCompare(right.id)
}

export function selectClaudeModel(models) {
  return models
    .filter((model) => /claude/i.test(`${model.id} ${model.name || ''}`))
    .map((model) => ({
      ...model,
      priority: tierPriority.find(([tier]) => new RegExp(tier, 'i').test(`${model.id} ${model.name || ''}`))?.[1] || 0,
    }))
    .filter((model) => model.priority > 0)
    .sort((left, right) => right.priority - left.priority || compareVersionsDescending(left, right))[0] || null
}