from __future__ import annotations

import abc
import json
import logging
from typing import Any

from jinja2 import Environment, PackageLoader, select_autoescape

from agents.base.context import AgentContext
from agents.base.output import BaseAgentOutput

logger = logging.getLogger(__name__)


class BaseAgent(abc.ABC):
    """Abstract base for all Credence evaluation agents."""

    role: str
    max_retries: int = 2

    def __init__(self, openai_client: Any) -> None:
        self.client = openai_client
        self._jinja = Environment(
            loader=PackageLoader("agents", package_path="agents"),
            autoescape=select_autoescape(),
        )

    @abc.abstractmethod
    def _get_system_prompt(self, context: AgentContext) -> str: ...

    @abc.abstractmethod
    def _get_user_prompt(self, context: AgentContext) -> str: ...

    @abc.abstractmethod
    def _parse_output(self, raw: str, context: AgentContext) -> BaseAgentOutput: ...

    async def run(self, context: AgentContext) -> BaseAgentOutput:
        system_prompt = self._get_system_prompt(context)
        user_prompt = self._get_user_prompt(context)

        for attempt in range(self.max_retries + 1):
            try:
                response = await self.client.chat.completions.create(
                    model="gpt-4o",
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.2,
                )
                raw = response.choices[0].message.content or "{}"
                return self._parse_output(raw, context)
            except Exception as exc:
                if attempt == self.max_retries:
                    logger.error("Agent %s failed after %d retries: %s", self.role, self.max_retries, exc)
                    raise
                logger.warning("Agent %s attempt %d failed: %s — retrying", self.role, attempt + 1, exc)

        raise RuntimeError(f"Agent {self.role} exhausted retries")  # unreachable

    def _render_template(self, path: str, **kwargs: Any) -> str:
        tmpl = self._jinja.get_template(path)
        return tmpl.render(**kwargs)

    def _parse_json(self, raw: str) -> dict[str, Any]:
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"LLM returned invalid JSON: {exc}") from exc
