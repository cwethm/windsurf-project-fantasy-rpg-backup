#!/usr/bin/env python3
"""
Test runner for Voxel MMO unit tests
Runs all test suites and generates a report
"""
import unittest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def run_all_tests():
    """Run all test suites"""
    loader = unittest.TestLoader()
    start_dir = os.path.dirname(__file__)
    suite = loader.discover(start_dir, pattern='test_*.py')
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "=" * 70)
    total = result.testsRun
    failures = len(result.failures)
    errors = len(result.errors)
    skipped = len(result.skipped)
    passed = total - failures - errors - skipped
    print(f"TOTAL: {total}  |  PASSED: {passed}  |  FAILED: {failures}  |  ERRORS: {errors}  |  SKIPPED: {skipped}")
    print("=" * 70)
    
    return result.wasSuccessful()

def run_specific_suite(suite_name):
    """Run a specific test suite"""
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromName(suite_name)
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()

if __name__ == '__main__':
    if len(sys.argv) > 1:
        # Run specific test suite
        suite_name = sys.argv[1]
        success = run_specific_suite(suite_name)
    else:
        # Run all tests
        print("=" * 70)
        print("Running Voxel MMO Test Suite")
        print("=" * 70)
        success = run_all_tests()
    
    sys.exit(0 if success else 1)
