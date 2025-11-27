import os
from typing import Dict, Any, Optional, List
import json

from .utils import ModelConfig


from langchain_openai import ChatOpenAI
from langchain_community.callbacks import get_openai_callback
from langchain.messages import HumanMessage, SystemMessage
from tenacity import retry, stop_after_attempt, wait_exponential


def create_model(config: ModelConfig):
    timeout_settings = {
        'request_timeout': 120,  # 2 minutes for request timeout
        'max_retries': 2,        # reduce retries at model level since we have tenacity
    }

    if config.provider == 'openai':
        openai_kwargs = {
            'model_name': config.model_name,
            'temperature': config.temperature,
            'max_tokens': config.max_tokens,
            'api_key': os.environ['OPENAI_API_KEY'],
            'request_timeout': timeout_settings['request_timeout'],
            'max_retries': timeout_settings['max_retries'],
        }
        base_url = os.environ['OPENAI_BASE_URL']
        if base_url:
            openai_kwargs['base_url'] = base_url
            
        return ChatOpenAI(**openai_kwargs)
    elif config.provider == 'zhipu':
        zhipu_kwargs = {
            'model': config.model_name,
            'temperature': config.temperature,
            'max_tokens': config.max_tokens,
            'api_key': os.environ['ZHIPU_API_KEY'],
            'timeout': timeout_settings['request_timeout'],
            'max_retries': timeout_settings['max_retries'],
        }
        base_url = os.environ['ZHIPU_BASE_URL']
        if base_url:
            zhipu_kwargs['base_url'] = base_url
            
        return ChatOpenAI(**zhipu_kwargs)

    else:
        raise NotImplementedError(f"Provider {config.provider} is not supported.")


class LangGraphAgent:
    def __init__(self, system_msg: str, config: ModelConfig):
        self.system_msg = system_msg
        self.config = config
        self.model = create_model(config)
        self.history = [SystemMessage(content=system_msg)]

    def reset(self):
        """reset conversation"""
        self.history = [SystemMessage(content=self.system_msg)]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    def step(self, message: str) -> 'AgentResponse':
        """process message and return response"""
        # check if message is json with image data
        try:
            msg_data = json.loads(message)
            # if isinstance(msg_data, list) and any("image_url" in item for item in msg_data):
            #     # vision model call
            #     return self._step_vision(msg_data)
        except:
            pass
        
        # regular text call
        self.history.append(HumanMessage(content=message))
        
        # keep conversation window
        if len(self.history) > 10:
            self.history = [self.history[0]] + self.history[-9:]
        
        # get response with token tracking
        input_tokens, output_tokens = 0, 0
        try:
            if self.config.provider in ('openai', 'zhipu'):
                with get_openai_callback() as cb:
                    response = self.model.invoke(self.history)
                    input_tokens = cb.prompt_tokens or 0
                    output_tokens = cb.completion_tokens or 0
            else:
                response = self.model.invoke(self.history)
                # estimate tokens for non-openai
                input_tokens = len(message.split()) * 1.3
                output_tokens = len(response.content.split()) * 1.3
        except Exception as e:
            error_msg = f"model call failed: {e}"
            print(error_msg)
            
            # provide more specific error information
            if "timeout" in str(e).lower() or "read operation timed out" in str(e).lower():
                print(f"⚠️  Timeout error detected for {self.config.provider} {self.config.model_name}")
                print("💡 Possible solutions:")
                print("   - Check your internet connection")
                print("   - Verify API key is valid")
                print("   - Try using a different model provider")
                print("   - Consider increasing timeout settings")
            elif "rate limit" in str(e).lower():
                print(f"⚠️  Rate limit exceeded for {self.config.provider}")
                print("💡 Consider adding delays between requests")
            elif "authentication" in str(e).lower() or "api key" in str(e).lower():
                print(f"⚠️  Authentication error for {self.config.provider}")
                print("💡 Check your API key configuration")
            
            input_tokens = len(message.split()) * 1.3
            output_tokens = 100
            raise
        
        self.history.append(response)
        
        return AgentResponse(response.content, input_tokens, output_tokens)

    def _step_vision(self, messages: List[Dict]) -> 'AgentResponse':
        """handle vision model calls"""
        # convert to proper format
        content = []
        for msg in messages:
            if msg.get("type") == "text":
                content.append({"type": "text", "text": msg["text"]})
            elif msg.get("type") == "image_url":
                content.append({
                    "type": "image_url",
                    "image_url": msg["image_url"]
                })
        
        human_msg = HumanMessage(content=content)
        
        # get response
        input_tokens, output_tokens = 0, 0
        try:
            if self.config.provider in ('openai', 'zhipu'):
                with get_openai_callback() as cb:
                    response = self.model.invoke([self.history[0], human_msg])
                    input_tokens = cb.prompt_tokens or 0
                    output_tokens = cb.completion_tokens or 0
            else:
                response = self.model.invoke([self.history[0], human_msg])
                # estimate tokens
                input_tokens = 200  # rough estimate for image
                output_tokens = len(response.content.split()) * 1.3
        except Exception as e:
            error_msg = f"vision model call failed: {e}"
            print(error_msg)
            
            # provide more specific error information for vision calls
            if "timeout" in str(e).lower() or "read operation timed out" in str(e).lower():
                print(f"⚠️  Vision timeout error detected for {self.config.provider} {self.config.model_name}")
                print("💡 Vision calls may take longer due to image processing")
                print("   - Consider using a different vision model")
                print("   - Check image size and format")
            elif "rate limit" in str(e).lower():
                print(f"⚠️  Rate limit exceeded for vision calls on {self.config.provider}")
            elif "authentication" in str(e).lower() or "api key" in str(e).lower():
                print(f"⚠️  Authentication error for vision calls on {self.config.provider}")
            
            raise
        
        return AgentResponse(response.content, input_tokens, output_tokens)

class AgentResponse:
    """agent response with token tracking"""
    def __init__(self, content: str, input_tokens: int, output_tokens: int):
        self.content = content
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens