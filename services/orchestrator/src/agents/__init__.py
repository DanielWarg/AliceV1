"""
Agents package for AliceV1 hybrid architecture.
Includes integrations from Lexi project.
"""

from .kasa_agent import KasaAgent
from .web_agent import WebAgent

__all__ = ["KasaAgent", "WebAgent"]
