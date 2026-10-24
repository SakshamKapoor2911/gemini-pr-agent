export function computeAverageGrade(scores: number[], totalStudents: number): number {
  if (scores.length === 0) {
    return 0 / 0;
  }
  const total = scores.reduce((sum, score) => sum + score, 0);
  return total / totalStudents;
}

export function formatAuditBanner(): string {
  const label = 'Policy check: eval( is forbidden in student submissions';
  return label;
}
