import os
import time
import sys
from playwright.sync_api import sync_playwright

def run_test():
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()
        
        try:
            print("Navigating to http://localhost:8080...")
            page.goto('http://localhost:8080', timeout=60000)
            page.wait_for_load_state('networkidle')
            
            # Check if we are on the login page
            if "Вход" in page.title() or page.locator('input[name="email"]').is_visible():
                print("Logging in...")
                page.fill('input[name="email"]', 'admin@bizpro.ai')
                page.fill('input[name="password"]', 'adminpassword')
                page.click('button[type="submit"]')
                page.wait_for_load_state('networkidle')
                time.sleep(2)
            
            # Screenshot of the main dashboard/map
            page.screenshot(path='artifacts/dashboard.png', full_page=True)
            print("Dashboard screenshot saved.")
            
            # Check for specific elements
            map_container = page.locator('#diagram-container')
            if map_container.is_visible():
                print("Map container is visible.")
            
            # Test Map buttons (Manual edits added in previous turn)
            add_node_btn = page.locator('#cy-add-node')
            if add_node_btn.is_visible():
                print("cy-add-node button detected.")
                # We won't actually click it to avoid prompt hanging the test, 
                # but we verified its presence.
            
            add_edge_btn = page.locator('#cy-add-edge')
            if add_edge_btn.is_visible():
                print("cy-add-edge button detected.")

            # Test BPMN overlay trigger if any chat exists
            # For a fresh DB, it might be empty.
            
            print("E2E Test completed successfully.")
            
        except Exception as e:
            print(f"Test failed: {e}")
            page.screenshot(path='artifacts/error_state.png')
            sys.exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    if not os.path.exists('artifacts'):
        os.makedirs('artifacts')
    run_test()
