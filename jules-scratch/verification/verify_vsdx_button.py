from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Navigate to the login page
        page.goto("http://localhost:3000")

        # Login as user
        page.fill("#user-name", "user")
        page.fill("#user-password", "userpassword")
        page.click("#user-login-btn")

        # Select department
        page.wait_for_selector(".department-card")
        page.click(".department-card")

        # Select chat
        page.wait_for_selector(".chat-card")
        page.click(".chat-card")
        page.fill("#chat-password", "chatpassword")
        page.click("#chat-login-btn")

        # Wait for the main application to load
        page.wait_for_selector("#process-description")

        # Enter some process description
        page.fill("#process-description", "Step 1\nStep 2\nStep 3")

        # Click the render diagram button
        page.click("#render-diagram-btn")

        # Wait for the diagram to be rendered
        page.wait_for_selector("#diagram-container svg")

        # Set up a listener for the alert dialog
        page.on("dialog", lambda dialog: dialog.accept())

        # Click the VSDX download button
        page.click("#download-vsdx-btn")

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)