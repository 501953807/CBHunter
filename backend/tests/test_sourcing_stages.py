"""Tests for sourcing pipeline stage transitions."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from app.services.sourcing_service import (
    validate_stage_transition,
    PIPELINE_STAGES,
    STAGE_TRANSITIONS,
)


class TestStageTransitions:
    def test_all_stages_in_definition(self):
        assert "discovery" in PIPELINE_STAGES
        assert "jit_testing" in PIPELINE_STAGES
        assert "active" in PIPELINE_STAGES
        assert "discontinued" in PIPELINE_STAGES

    def test_discovery_to_jit_testing(self):
        assert validate_stage_transition("discovery", "jit_testing") is None

    def test_discovery_to_active(self):
        assert validate_stage_transition("discovery", "active") is None

    def test_jit_testing_to_jit_passed(self):
        assert validate_stage_transition("jit_testing", "jit_passed") is None

    def test_same_stage_rejected(self):
        error = validate_stage_transition("discovery", "discovery")
        assert error is not None
        assert "相同" in error

    def test_invalid_transition_rejected(self):
        error = validate_stage_transition("active", "discovery")
        assert error is not None
        assert "不允许" in error

    def test_discontinued_is_terminal(self):
        error = validate_stage_transition("discontinued", "active")
        assert error is not None

    def test_unknown_stage(self):
        error = validate_stage_transition("invalid_stage", "active")
        assert error is not None

    def test_allowable_targets(self):
        """Each stage's transitions should be valid."""
        for stage, targets in STAGE_TRANSITIONS.items():
            for target in targets:
                assert validate_stage_transition(stage, target) is None, \
                    f"Expected {stage} -> {target} to be valid"
