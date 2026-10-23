"""CheryGuard 数据工具 —— GuardDataset 和 DataCollator"""

import json
import torch
from torch.utils.data import Dataset


class GuardDataset(Dataset):
    """CheryGuard 训练数据集

    加载 JSONL 格式的训练数据，每条包含:
    - text: 完整的输入文本（含 assistant 前缀）
    - labels_text: 期望的输出标签文本

    Tokenize 后：input 部分 labels=-100（不计算 loss），output 部分保留原 token id。
    """

    def __init__(self, data_path: str, tokenizer, max_length: int = 2048):
        self.data = []
        with open(data_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    self.data.append(json.loads(line))
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        item = self.data[idx]

        # Tokenize 输入文本（不计算 loss）
        input_ids = self.tokenizer.encode(item["text"], add_special_tokens=False)

        # Tokenize 输出标签（计算 loss）
        label_ids = self.tokenizer.encode(item["labels_text"], add_special_tokens=False)

        # 拼接: input 部分 labels=-100, output 部分保留
        full_ids = input_ids + label_ids
        labels = [-100] * len(input_ids) + label_ids

        # 截断到最大长度
        if len(full_ids) > self.max_length:
            full_ids = full_ids[: self.max_length]
            labels = labels[: self.max_length]

        return {
            "input_ids": torch.tensor(full_ids, dtype=torch.long),
            "labels": torch.tensor(labels, dtype=torch.long),
            "attention_mask": torch.ones(len(full_ids), dtype=torch.long),
        }


def load_jsonl(file_path: str) -> list:
    """加载 JSONL 文件"""
    data = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                data.append(json.loads(line))
    return data


def save_jsonl(data: list, file_path: str):
    """保存 JSONL 文件"""
    with open(file_path, "w", encoding="utf-8") as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")


def stratified_split(
    data: list,
    label_key: str = "teacher_safety",
    train_ratio: float = 0.8,
    val_ratio: float = 0.1,
    test_ratio: float = 0.1,
    seed: int = 42,
) -> tuple:
    """分层采样划分训练/验证/测试集

    Args:
        data: 样本列表
        label_key: 用于分层的标签字段名
        train_ratio/val_ratio/test_ratio: 划分比例
        seed: 随机种子

    Returns:
        (train_data, val_data, test_data) 三元组
    """
    from collections import defaultdict
    import random

    random.seed(seed)

    # 按标签分组
    groups = defaultdict(list)
    for item in data:
        label = item.get(label_key, "Unknown")
        groups[label].append(item)

    train_data, val_data, test_data = [], [], []

    for label, items in groups.items():
        random.shuffle(items)
        n = len(items)
        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)

        train_data.extend(items[:n_train])
        val_data.extend(items[n_train : n_train + n_val])
        test_data.extend(items[n_train + n_val :])

    # 再次打乱
    random.shuffle(train_data)
    random.shuffle(val_data)
    random.shuffle(test_data)

    return train_data, val_data, test_data