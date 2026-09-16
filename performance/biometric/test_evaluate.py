"""Unit tests for biometric threshold calculations."""

import unittest

from performance.biometric.evaluate import (
    build_thresholds,
    compute_threshold_metrics,
)


class ThresholdEvaluationTests(unittest.TestCase):
    def test_build_thresholds_is_inclusive_and_decimal_safe(self):
        self.assertEqual(build_thresholds(0.30, 0.33, 0.01), [0.3, 0.31, 0.32, 0.33])

    def test_far_and_frr_use_strict_production_match_rule(self):
        [metrics] = compute_threshold_metrics(
            genuine_distances=[0.20, 0.40, 0.45],
            impostor_distances=[0.35, 0.40, 0.70],
            thresholds=[0.40],
        )

        self.assertEqual(metrics["false_rejects"], 2)
        self.assertEqual(metrics["false_accepts"], 1)
        self.assertAlmostEqual(metrics["false_reject_rate"], 2 / 3)
        self.assertAlmostEqual(metrics["false_accept_rate"], 1 / 3)

    def test_both_comparison_classes_are_required(self):
        with self.assertRaises(ValueError):
            compute_threshold_metrics([], [0.7], [0.4])
        with self.assertRaises(ValueError):
            compute_threshold_metrics([0.2], [], [0.4])


if __name__ == "__main__":
    unittest.main()
