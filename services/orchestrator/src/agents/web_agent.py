"""
WebAgent - Browser automation using Playwright and Gemini.
Ported from Lexi to AliceV1 hybrid architecture.
"""

import os
import asyncio
import base64
from dotenv import load_dotenv
from playwright.async_api import async_playwright

# Configuration
SCREEN_WIDTH = 1440
SCREEN_HEIGHT = 900


class WebAgent:
    """Playwright-based web automation agent."""
    
    def __init__(self):
        self.browser = None
        self.context = None
        self.page = None

    async def navigate(self, url: str) -> dict:
        """Navigate to a URL."""
        if not self.page:
            return {"error": "Browser not initialized"}
        
        try:
            await self.page.goto(url)
            return {"success": True, "url": self.page.url}
        except Exception as e:
            return {"error": str(e)}

    async def click(self, x: int, y: int) -> dict:
        """Click at coordinates."""
        if not self.page:
            return {"error": "Browser not initialized"}
        
        try:
            await self.page.mouse.click(x, y)
            return {"success": True}
        except Exception as e:
            return {"error": str(e)}

    async def type_text(self, text: str, x: int = None, y: int = None, 
                       clear_before: bool = True, press_enter: bool = False) -> dict:
        """Type text, optionally at specific coordinates."""
        if not self.page:
            return {"error": "Browser not initialized"}
        
        try:
            if x is not None and y is not None:
                await self.page.mouse.click(x, y)
            
            if clear_before:
                await self.page.keyboard.press("Control+A")
                await self.page.keyboard.press("Backspace")
            
            await self.page.keyboard.type(text)
            
            if press_enter:
                await self.page.keyboard.press("Enter")
            
            return {"success": True}
        except Exception as e:
            return {"error": str(e)}

    async def scroll(self, direction: str = "down", amount: int = 800) -> dict:
        """Scroll the page."""
        if not self.page:
            return {"error": "Browser not initialized"}
        
        try:
            dx, dy = 0, 0
            if direction == "down":
                dy = amount
            elif direction == "up":
                dy = -amount
            elif direction == "right":
                dx = amount
            elif direction == "left":
                dx = -amount
            
            await self.page.mouse.wheel(dx, dy)
            return {"success": True}
        except Exception as e:
            return {"error": str(e)}

    async def screenshot(self) -> bytes:
        """Take a screenshot."""
        if not self.page:
            return None
        
        return await self.page.screenshot(type="png")

    async def get_page_content(self) -> dict:
        """Get page title and URL."""
        if not self.page:
            return {"error": "Browser not initialized"}
        
        return {
            "url": self.page.url,
            "title": await self.page.title()
        }

    async def run_task(self, prompt: str, update_callback=None) -> str:
        """
        Run a simple browser task.
        
        Args:
            prompt: Task description
            update_callback: async function(screenshot_b64: str, logs: str)
        
        Returns:
            Final status message
        """
        print(f"[WebAgent] Starting task: {prompt}")
        
        async with async_playwright() as p:
            self.browser = await p.chromium.launch(headless=True)
            self.context = await self.browser.new_context(
                viewport={"width": SCREEN_WIDTH, "height": SCREEN_HEIGHT},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            self.page = await self.context.new_page()
            
            # Start at Google
            await self.page.goto("https://www.google.com")
            
            if update_callback:
                screenshot = await self.screenshot()
                if screenshot:
                    encoded = base64.b64encode(screenshot).decode('utf-8')
                    await update_callback(encoded, "Browser initialized")
            
            # For now, just search if prompt looks like a search query
            if "search" in prompt.lower() or "find" in prompt.lower():
                # Extract search terms (simple heuristic)
                search_terms = prompt
                for word in ["search for", "search", "find", "look up", "google"]:
                    search_terms = search_terms.lower().replace(word, "").strip()
                
                # Type in Google search
                await self.page.keyboard.type(search_terms)
                await self.page.keyboard.press("Enter")
                await asyncio.sleep(2)
                
                if update_callback:
                    screenshot = await self.screenshot()
                    if screenshot:
                        encoded = base64.b64encode(screenshot).decode('utf-8')
                        await update_callback(encoded, f"Searched for: {search_terms}")
            
            await self.browser.close()
            print("[WebAgent] Task completed")
            return f"Completed task: {prompt}"


# Standalone test
if __name__ == "__main__":
    async def main():
        agent = WebAgent()
        result = await agent.run_task("Search for weather Stockholm")
        print(result)
    
    asyncio.run(main())
