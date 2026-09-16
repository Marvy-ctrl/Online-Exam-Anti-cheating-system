"""Unit tests for repeated-observation policy behavior."""

import unittest

from performance.session_policy.evaluate import POLICIES, first_alert


POLICY_BY_NAME = {policy.name: policy for policy in POLICIES}


class SessionPolicyTests(unittest.TestCase):
    def test_current_policy_alerts_on_first_anomaly(self):
        policy = POLICY_BY_NAME["single_anomaly_current"]
        self.assertEqual(first_alert(policy, ["match", "mismatch"]), (2, "face_mismatch"))
        self.assertEqual(first_alert(policy, ["no_face"]), (1, "no_face"))

    def test_match_breaks_consecutive_mismatch_streak(self):
        policy = POLICY_BY_NAME["three_consecutive_mismatches"]
        observations = ["mismatch", "mismatch", "match", "mismatch", "mismatch"]
        self.assertEqual(first_alert(policy, observations), (None, None))
        self.assertEqual(
            first_alert(policy, [*observations, "mismatch"]),
            (6, "face_mismatch"),
        )

    def test_three_of_five_tolerates_intervening_match(self):
        policy = POLICY_BY_NAME["three_mismatches_in_five"]
        observations = ["mismatch", "match", "mismatch", "match", "mismatch"]
        self.assertEqual(first_alert(policy, observations), (5, "face_mismatch"))

    def test_no_face_and_multiple_faces_have_separate_rules(self):
        policy = POLICY_BY_NAME["two_consecutive_mismatches"]
        self.assertEqual(
            first_alert(policy, ["no_face", "no_face", "no_face"]),
            (3, "no_face"),
        )
        self.assertEqual(
            first_alert(policy, ["multiple_faces", "match", "multiple_faces"]),
            (3, "multiple_faces"),
        )

    def test_technical_error_is_not_identity_evidence_for_candidates(self):
        policy = POLICY_BY_NAME["three_consecutive_mismatches"]
        self.assertEqual(
            first_alert(policy, ["technical_error"] * 9),
            (None, None),
        )


if __name__ == "__main__":
    unittest.main()
