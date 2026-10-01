#!/usr/bin/env python3
"""
Test Framework & Reporting Engine for Escolar E2E Navigation Refactoring
Provides tiered test execution, assertions, timing, formatted reporting, and exit code handling.
Cross-platform and Windows CP1252 / UTF-8 compatible.
"""

import time
import sys
import traceback
from typing import Callable, List, Dict, Any, Optional

# Ensure UTF-8 stdout if supported
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

class TestCase:
    def __init__(self, name: str, tier: str, description: str, func: Callable):
        self.name = name
        self.tier = tier
        self.description = description
        self.func = func
        self.status = "PENDING"  # PASS, FAIL, SKIP
        self.duration_ms = 0.0
        self.error_message = ""
        self.error_trace = ""

class TestSuiteRunner:
    def __init__(self, suite_name: str = "Escolar Navigation E2E Test Suite"):
        self.suite_name = suite_name
        self.tests: List[TestCase] = []
        self.tier_order = [
            "Tier 1: Feature Coverage",
            "Tier 2: Boundary & Corner Cases",
            "Tier 3: Cross-Feature Combinations",
            "Tier 4: Real-World Application Scenarios"
        ]

    def register(self, tier: str, name: str, description: str):
        """Decorator to register a test case into the suite."""
        def decorator(func: Callable):
            test_case = TestCase(name=name, tier=tier, description=description, func=func)
            self.tests.append(test_case)
            return func
        return decorator

    def run_all(self, filter_tier: Optional[str] = None) -> int:
        print("=" * 80)
        print(f"[RUNNING] {self.suite_name}")
        print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
        print("=" * 80)

        start_time = time.time()
        tests_to_run = self.tests
        if filter_tier:
            tests_to_run = [t for t in self.tests if filter_tier.lower() in t.tier.lower()]

        by_tier: Dict[str, List[TestCase]] = {}
        for t in tests_to_run:
            by_tier.setdefault(t.tier, []).append(t)

        passed_total = 0
        failed_total = 0

        # Execute in structured order
        tier_keys = sorted(by_tier.keys(), key=lambda k: self._tier_sort_key(k))

        for tier in tier_keys:
            tier_tests = by_tier[tier]
            print(f"\n[{tier}] ({len(tier_tests)} tests)")
            print("-" * 80)

            for test in tier_tests:
                t0 = time.time()
                try:
                    test.func()
                    test.duration_ms = (time.time() - t0) * 1000.0
                    test.status = "PASS"
                    passed_total += 1
                    status_badge = "[PASS]"
                    print(f"  {status_badge} {test.name} ({test.duration_ms:.2f}ms)")
                    print(f"         -> {test.description}")
                except Exception as e:
                    test.duration_ms = (time.time() - t0) * 1000.0
                    test.status = "FAIL"
                    test.error_message = str(e)
                    test.error_trace = traceback.format_exc()
                    failed_total += 1
                    status_badge = "[FAIL]"
                    print(f"  {status_badge} {test.name} ({test.duration_ms:.2f}ms)")
                    print(f"         -> {test.description}")
                    print(f"         [ERROR]: {e}")

        total_elapsed = time.time() - start_time
        print("\n" + "=" * 80)
        print("TEST EXECUTION SUMMARY BY TIER")
        print("=" * 80)

        for tier in tier_keys:
            tier_tests = by_tier[tier]
            t_pass = sum(1 for t in tier_tests if t.status == "PASS")
            t_fail = sum(1 for t in tier_tests if t.status == "FAIL")
            tier_status = "ALL PASSED" if t_fail == 0 else f"{t_fail} FAILED"
            badge = "[OK]" if t_fail == 0 else "[X]"
            print(f"  {badge}  {tier:<42} | Passed: {t_pass:>2}/{len(tier_tests):<2} | Status: {tier_status}")

        print("-" * 80)
        total_tests = len(tests_to_run)
        print(f"Total Tests Executed: {total_tests}")
        print(f"Total Passed:        {passed_total}")
        print(f"Total Failed:        {failed_total}")
        print(f"Total Elapsed Time:  {total_elapsed:.3f} seconds")
        print("=" * 80)

        if failed_total > 0:
            print("\nDETAILED FAILURE TRACES:")
            for t in tests_to_run:
                if t.status == "FAIL":
                    print(f"\n--- FAILED: {t.tier} -> {t.name} ---")
                    print(t.error_trace)
            return 1

        print("\nALL TEST TIERS PASSED PERFECTLY WITH ZERO DEFECTS! (Exit code 0)\n")
        return 0

    def _tier_sort_key(self, tier_name: str) -> int:
        for idx, key in enumerate(self.tier_order):
            if key.lower() in tier_name.lower():
                return idx
        return 99

# Global singleton runner
runner = TestSuiteRunner()

# Helper assertion functions
def assert_equal(actual: Any, expected: Any, msg: str = ""):
    if actual != expected:
        raise AssertionError(f"Expected {expected!r}, but got {actual!r}. {msg}".strip())

def assert_not_equal(actual: Any, unexpected: Any, msg: str = ""):
    if actual == unexpected:
        raise AssertionError(f"Expected value to differ from {unexpected!r}. {msg}".strip())

def assert_true(condition: bool, msg: str = ""):
    if not condition:
        raise AssertionError(f"Expected condition to be True. {msg}".strip())

def assert_false(condition: bool, msg: str = ""):
    if condition:
        raise AssertionError(f"Expected condition to be False. {msg}".strip())

def assert_in(item: Any, container: Any, msg: str = ""):
    if item not in container:
        raise AssertionError(f"Expected {item!r} to be in {container!r}. {msg}".strip())

def assert_not_in(item: Any, container: Any, msg: str = ""):
    if item in container:
        raise AssertionError(f"Expected {item!r} NOT to be in {container!r}. {msg}".strip())
