"""Unit tests for face-worker benchmark calculations."""

import unittest

from performance.face_worker.run import percentile, timing_summary


class FaceWorkerMetricsTests(unittest.TestCase):
    def test_percentile_interpolates(self):
        self.assertEqual(percentile([10, 20, 30], 50), 20)
        self.assertEqual(percentile([10, 20], 50), 15)

    def test_percentile_handles_empty_values(self):
        self.assertIsNone(percentile([], 95))

    def test_timing_summary_reports_tail_and_max(self):
        summary = timing_summary([10, 20, 30, 40, 50])
        self.assertEqual(summary["p50_ms"], 30)
        self.assertEqual(summary["max_ms"], 50)
        self.assertGreater(summary["p95_ms"], 40)


if __name__ == "__main__":
    unittest.main()
