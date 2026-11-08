import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from research_daily_gainers_tts_request_shape import (  # noqa: E402
    combined_narration,
    partition_narrations,
    validate_expected_request_count,
)
from tts_request_shape_transport import (  # noqa: E402
    RequestBudget,
    RequestCapExceeded,
    RequestShapeObservation,
)


class RequestShapeExperimentTests(unittest.TestCase):
    def test_ten_contiguous_groups_reconstruct_same_ordered_text(self):
        scenes = [f"scene-{index}-內容" for index in range(16)]
        combined = combined_narration(scenes)
        groups = partition_narrations(scenes, 10)
        self.assertEqual(len(groups), 10)
        self.assertEqual("\n\n".join(groups), combined)
        self.assertTrue(all(groups))
        self.assertEqual([part for group in groups for part in group.split("\n\n")], scenes)

    def test_partition_rejects_invalid_group_count(self):
        with self.assertRaises(ValueError):
            partition_narrations(["one", "two"], 10)

    def test_preflight_enforces_fifteen_connection_cap(self):
        self.assertTrue(validate_expected_request_count(13, 15))
        self.assertTrue(validate_expected_request_count(15, 15))
        self.assertFalse(validate_expected_request_count(16, 15))
        with self.assertRaises(ValueError):
            validate_expected_request_count(-1, 15)

    def test_budget_counts_connections_and_fails_closed_at_cap(self):
        budget = RequestBudget(2)
        observation = RequestShapeObservation(budget)
        first = observation.begin_connection()
        second = observation.begin_connection()
        self.assertEqual((first["global_ordinal"], second["global_ordinal"]), (1, 2))
        with self.assertRaises(RequestCapExceeded):
            observation.begin_connection()
        report = observation.as_dict()
        self.assertEqual(report["websocket_connection_attempt_count"], 2)
        self.assertEqual(budget.used, 2)

    def test_transport_diagnostics_store_sizes_but_not_message_payload(self):
        class MessageType:
            name = "TEXT"

        class Message:
            type = MessageType()
            data = "PRIVATE TRANSCRIPT"

        observation = RequestShapeObservation(RequestBudget(2))
        connection = observation.begin_connection()
        observation.record_message(Message(), connection)
        serialized = json.dumps(observation.as_dict())
        self.assertNotIn("PRIVATE TRANSCRIPT", serialized)
        self.assertEqual(connection["message_bytes"]["TEXT"], len("PRIVATE TRANSCRIPT"))
        self.assertEqual(connection["message_counts"]["TEXT"], 1)


if __name__ == "__main__":
    unittest.main()
