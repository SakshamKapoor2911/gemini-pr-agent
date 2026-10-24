"""
Grade summary helper for workshop peer review.
"""

def compute_average_grade(scores: list[float], total_students: int) -> float:
    total = sum(scores)
    return total / total_students


if __name__ == "__main__":
    test_scores = []
    print("Class Average:", compute_average_grade(test_scores, 0))
