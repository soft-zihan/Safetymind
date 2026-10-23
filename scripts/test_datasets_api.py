#!/usr/bin/env python3
"""Test script for Qise Datasets API.

Usage:
    # Start server first:
    python -m qise.datasets_server --port 8900 &
    
    # Run tests:
    python scripts/test_datasets_api.py
"""

import json
import sys
import time
from pathlib import Path

import requests

BASE_URL = "http://localhost:8900"


def test_health():
    """Test health check endpoint."""
    print("\n=== Test: Health Check ===")
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    print(f"✓ Health check passed: {data}")


def test_list_datasets():
    """Test listing all datasets."""
    print("\n=== Test: List All Datasets ===")
    response = requests.get(f"{BASE_URL}/api/datasets")
    assert response.status_code == 200
    data = response.json()
    
    print(f"Version: {data['version']}")
    print(f"Categories: {list(data['categories'].keys())}")
    print(f"Statistics: {json.dumps(data['statistics'], indent=2)}")
    
    assert "categories" in data
    assert "raw" in data["categories"]
    assert "training" in data["categories"]
    assert "evaluation" in data["categories"]
    print("✓ List datasets passed")


def test_get_stats():
    """Test getting statistics."""
    print("\n=== Test: Get Statistics ===")
    response = requests.get(f"{BASE_URL}/api/datasets/stats")
    assert response.status_code == 200
    data = response.json()
    
    print(f"Total datasets: {data['total_datasets']}")
    print(f"Raw samples: {data['total_raw_samples']:,}")
    print(f"Training samples: {data['total_training_samples']:,}")
    print(f"Eval samples: {data['total_eval_samples']:,}")
    
    assert data["total_datasets"] > 0
    assert data["total_raw_samples"] > 0
    print("✓ Get stats passed")


def test_list_by_category():
    """Test listing datasets by category."""
    print("\n=== Test: List by Category ===")
    
    for category in ["raw", "training", "evaluation"]:
        response = requests.get(f"{BASE_URL}/api/datasets/{category}")
        assert response.status_code == 200
        data = response.json()
        
        print(f"\n{category.upper()} ({len(data['datasets'])} datasets):")
        for ds in data["datasets"][:3]:  # Show first 3
            print(f"  - {ds['id']}: {ds['total_samples']:,} samples")
        
        assert "datasets" in data
        assert len(data["datasets"]) > 0
    
    print("\n✓ List by category passed")


def test_get_dataset():
    """Test getting dataset details."""
    print("\n=== Test: Get Dataset Details ===")
    
    # Test raw dataset
    response = requests.get(f"{BASE_URL}/api/datasets/agentdojo")
    assert response.status_code == 200
    data = response.json()
    
    print(f"Dataset: {data['id']}")
    print(f"  Format: {data['format']}")
    print(f"  Samples: {data['total_samples']:,}")
    print(f"  Size: {data['file_size']}")
    
    assert data["id"] == "agentdojo"
    assert data["total_samples"] > 0
    print("✓ Get dataset passed")


def test_get_samples_jsonl():
    """Test getting JSONL samples."""
    print("\n=== Test: Get JSONL Samples ===")
    
    response = requests.get(
        f"{BASE_URL}/api/datasets/processed_task1_injection/samples",
        params={"page": 1, "page_size": 3}
    )
    assert response.status_code == 200
    data = response.json()
    
    print(f"Dataset: {data['dataset_id']}")
    print(f"Total: {data['total']:,}")
    print(f"Page: {data['page']}")
    print(f"Samples returned: {len(data['samples'])}")
    
    if data["samples"]:
        sample = data["samples"][0]
        print(f"\nFirst sample preview:")
        print(f"  Messages: {len(sample.get('messages', []))}")
        if sample.get("messages"):
            print(f"  User content (first 100 chars): {sample['messages'][1]['content'][:100]}...")
    
    assert data["dataset_id"] == "processed_task1_injection"
    assert len(data["samples"]) <= 3
    print("✓ Get JSONL samples passed")


def test_get_samples_yaml():
    """Test getting YAML samples."""
    print("\n=== Test: Get YAML Samples ===")
    
    response = requests.get(
        f"{BASE_URL}/api/datasets/injection_attacks/samples",
        params={"page": 1, "page_size": 2}
    )
    assert response.status_code == 200
    data = response.json()
    
    print(f"Dataset: {data['dataset_id']}")
    print(f"Total: {data['total']}")
    print(f"Samples returned: {len(data['samples'])}")
    
    if data["samples"]:
        sample = data["samples"][0]
        print(f"\nFirst sample preview:")
        print(f"  ID: {sample.get('id')}")
        print(f"  Category: {sample.get('category')}")
        print(f"  Expected verdict: {sample.get('expected_verdict')}")
    
    assert data["dataset_id"] == "injection_attacks"
    print("✓ Get YAML samples passed")


def test_scan_datasets():
    """Test scanning datasets."""
    print("\n=== Test: Scan Datasets ===")
    
    response = requests.post(f"{BASE_URL}/api/datasets/scan")
    assert response.status_code == 200
    data = response.json()
    
    print(f"Status: {data['status']}")
    print(f"Message: {data['message'][:100]}...")
    
    assert data["status"] == "success"
    print("✓ Scan datasets passed")


def test_not_found():
    """Test 404 error handling."""
    print("\n=== Test: Not Found ===")
    
    response = requests.get(f"{BASE_URL}/api/datasets/nonexistent")
    assert response.status_code == 404
    
    print("✓ Not found handling passed")


def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("Qise Datasets API Test Suite")
    print("=" * 60)
    
    tests = [
        test_health,
        test_list_datasets,
        test_get_stats,
        test_list_by_category,
        test_get_dataset,
        test_get_samples_jsonl,
        test_get_samples_yaml,
        test_scan_datasets,
        test_not_found,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"\n✗ {test.__name__} FAILED: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    # Wait for server to start
    print("Waiting for server to start...")
    time.sleep(2)
    
    run_all_tests()
