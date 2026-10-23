#!/usr/bin/env python3
"""Generate dataset registry.json by scanning datasets directory."""

import json
from datetime import datetime
from pathlib import Path

DATASETS_ROOT = Path(__file__).resolve().parent.parent / "qise" / "datasets"

def count_jsonl_lines(path: Path) -> int:
    """Count lines in a JSONL file."""
    try:
        with open(path) as f:
            return sum(1 for line in f if line.strip())
    except:
        return 0

def get_file_size_mb(path: Path) -> float:
    """Get file size in MB."""
    try:
        return path.stat().st_size / (1024 * 1024)
    except:
        return 0.0

def scan_raw():
    """Scan raw datasets."""
    datasets = []
    raw_dir = DATASETS_ROOT / "raw"
    
    if not raw_dir.exists():
        return datasets
    
    for subdir in sorted(raw_dir.iterdir()):
        if not subdir.is_dir() or subdir.name.startswith('.'):
            continue
        
        # Find main data file
        data_file = None
        for ext in ['*.json', '*.jsonl', '*.parquet']:
            files = list(subdir.glob(ext))
            if files:
                data_file = files[0]
                break
        
        if not data_file:
            continue
        
        # Determine format and count samples
        # Check if it's JSONL (even if .json extension)
        try:
            with open(data_file) as f:
                first_line = f.readline()
                json.loads(first_line)
                # If successful, it's JSONL
                format_type = 'jsonl'
                f.seek(0)
                samples = sum(1 for line in f if line.strip())
        except:
            # Try as JSON array
            try:
                with open(data_file) as f:
                    data = json.load(f)
                    format_type = 'json'
                    samples = len(data) if isinstance(data, list) else 1
            except:
                format_type = 'unknown'
                samples = 0
        
        datasets.append({
            "id": subdir.name,
            "name": subdir.name.replace('_', ' ').title(),
            "category": "raw",
            "path": f"raw/{subdir.name}/{data_file.name}",
            "format": format_type,
            "total_samples": samples,
            "file_size": f"{get_file_size_mb(data_file):.1f}MB",
            "status": "ready",
            "usage": ["training", "evaluation"] if subdir.name in ['agentdojo', 'cyberseceval'] else ["training"],
        })
    
    return datasets

def scan_training():
    """Scan training datasets."""
    datasets = []
    training_dir = DATASETS_ROOT / "training"
    
    for category in ['processed', 'synthetic']:
        cat_dir = training_dir / category
        if not cat_dir.exists():
            continue
        
        for jsonl_file in sorted(cat_dir.glob("*.jsonl")):
            samples = count_jsonl_lines(jsonl_file)
            datasets.append({
                "id": f"{category}_{jsonl_file.stem}",
                "name": jsonl_file.stem.replace('_', ' ').title(),
                "category": "training",
                "path": f"training/{category}/{jsonl_file.name}",
                "format": "jsonl",
                "total_samples": samples,
                "file_size": f"{get_file_size_mb(jsonl_file):.1f}MB",
                "status": "ready",
                "source": "convert.py" if category == "processed" else "synthesize.py",
            })
    
    return datasets

def scan_evaluation():
    """Scan evaluation datasets."""
    datasets = []
    eval_dir = DATASETS_ROOT / "evaluation" / "manual"
    
    if not eval_dir.exists():
        return datasets
    
    for yaml_file in sorted(eval_dir.glob("*.yaml")):
        # Count cases in YAML
        try:
            import yaml
            with open(yaml_file) as f:
                data = yaml.safe_load(f)
                samples = len(data.get('cases', []))
        except:
            samples = 0
        
        datasets.append({
            "id": yaml_file.stem,
            "name": yaml_file.stem.replace('_', ' ').title(),
            "category": "evaluation",
            "path": f"evaluation/manual/{yaml_file.name}",
            "format": "yaml",
            "total_samples": samples,
            "file_size": f"{get_file_size_mb(yaml_file):.1f}MB",
            "status": "ready",
            "source": "manual",
        })
    
    return datasets

def generate_statistics(all_datasets):
    """Generate statistics."""
    stats = {
        "total_datasets": len(all_datasets),
        "total_raw_samples": 0,
        "total_training_samples": 0,
        "total_eval_samples": 0,
    }
    
    for ds in all_datasets:
        if ds['category'] == 'raw':
            stats['total_raw_samples'] += ds['total_samples']
        elif ds['category'] == 'training':
            stats['total_training_samples'] += ds['total_samples']
        elif ds['category'] == 'evaluation':
            stats['total_eval_samples'] += ds['total_samples']
    
    return stats

def main():
    print("Scanning datasets...")
    
    all_datasets = []
    all_datasets.extend(scan_raw())
    all_datasets.extend(scan_training())
    all_datasets.extend(scan_evaluation())
    
    registry = {
        "version": "3.0.0",
        "generated_at": datetime.now().isoformat(),
        "categories": {
            "raw": {
                "description": "原始数据（源文件，只读）",
                "datasets": [d for d in all_datasets if d['category'] == 'raw']
            },
            "training": {
                "description": "训练数据（JSONL, messages 格式）",
                "datasets": [d for d in all_datasets if d['category'] == 'training']
            },
            "evaluation": {
                "description": "评估数据（YAML, GuardContext 格式）",
                "datasets": [d for d in all_datasets if d['category'] == 'evaluation']
            }
        },
        "statistics": generate_statistics(all_datasets)
    }
    
    # Write registry
    output_path = DATASETS_ROOT / "registry.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Registry generated: {output_path}")
    print(f"  Total datasets: {registry['statistics']['total_datasets']}")
    print(f"  Raw samples: {registry['statistics']['total_raw_samples']:,}")
    print(f"  Training samples: {registry['statistics']['total_training_samples']:,}")
    print(f"  Eval samples: {registry['statistics']['total_eval_samples']:,}")

if __name__ == "__main__":
    main()
