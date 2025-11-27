
from typing import Dict, Any, Optional, List, Tuple, TypedDict
from dataclasses import dataclass


@dataclass
class ModelConfig:
    model_name: str
    provider: str
    temperature: float = 0.7
    max_tokens: int = 4096


def _get_model_config(model_id: str) -> ModelConfig:
    """get model configuration"""
    configs = {
        # "claude": ModelConfig("claude-sonnet-4-20250514", "anthropic"),
        # "claude-sonnet-4-20250514": ModelConfig("claude-sonnet-4-20250514", "anthropic"),
        # "gemini": ModelConfig("gemini-2.5-pro", "google"),
        # "gemini-2.5-pro": ModelConfig("gemini-2.5-pro", "google"),
        # "gpt-4o-2024-08-06": ModelConfig("gpt-4o-2024-08-06", "openai"),
        # "gpt-4.1-2025-04-14": ModelConfig("gpt-4.1-2025-04-14", "openai"),
        # "gpt-4.1-mini-2025-04-14": ModelConfig("gpt-4.1-mini-2025-04-14", "openai"),
        "glm-4.6": ModelConfig("glm-4.6", "zhipu"),
        "glm-4.5": ModelConfig("glm-4.5", "zhipu"),
        "glm-4.5-air": ModelConfig("glm-4.5-air", "zhipu"),
        "glm-4.5v": ModelConfig("glm-4.5v", "zhipu"),
        "glm-4": ModelConfig("glm-4", "zhipu"),
        "glm-4v": ModelConfig("glm-4v", "zhipu"),
        # "kimi-k2-turbo-preview": ModelConfig("kimi-k2-turbo-preview", "moonshot"),
        # "moonshot-v1-8k-vision-preview": ModelConfig("moonshot-v1-8k-vision-preview", "moonshot"),
        # "MiniMax-M2": ModelConfig("MiniMax-M2", "Minimax"),
        # "qwen3-max": ModelConfig("qwen3-max", "Alibaba"),
        # "qwen3-vl-plus": ModelConfig("qwen3-vl-plus", "Alibaba"),
    }
    return configs.get(model_id, configs["glm-4.5-air"])