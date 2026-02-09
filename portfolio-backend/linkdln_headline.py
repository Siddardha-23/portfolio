from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

# ---------- Configuration ----------
LINKEDIN_EMAIL = "rabekar788@asaption.com"
LINKEDIN_PASSWORD = "Siddu@2002"
first_name = "Surya"
middle_name = "Teja"
last_name = "Kommuguri"

chrome_options = Options()
chrome_options.add_argument("--headless")  # Headless mode
chrome_options.add_argument("--window-size=1920,1080")
chrome_options.add_argument("--disable-blink-features=AutomationControlled")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.add_argument("--disable-gpu")
chrome_options.add_argument("--disable-software-rasterizer")
chrome_options.add_argument("--use-gl=desktop")  # Or: --use-gl=swiftshader
chrome_options.add_argument("--ignore-gpu-blocklist")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
chrome_options.add_argument("--disable-extensions")
chrome_options.add_argument("--disable-infobars")
chrome_options.add_argument("--disable-background-networking")
chrome_options.add_argument("--disable-default-apps")
chrome_options.add_argument("--disable-sync")
chrome_options.add_argument("--metrics-recording-only")
chrome_options.add_argument(
    "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
)

# ---------- Setup ----------
driver = webdriver.Chrome(options=chrome_options)
driver.maximize_window()
wait = WebDriverWait(driver, 15)

# ---------- Step 1: Login ----------
driver.get("https://www.linkedin.com/login")
wait.until(EC.presence_of_element_located((By.ID, "username"))).send_keys(LINKEDIN_EMAIL)
driver.find_element(By.ID, "password").send_keys(LINKEDIN_PASSWORD)
driver.find_element(By.XPATH, "//button[@type='submit']").click()

# ---------- Step 2: Search Name ----------
full_name = f"{first_name} {middle_name} {last_name}".strip()
wait.until(EC.presence_of_element_located((By.XPATH, "//input[contains(@placeholder, 'Search')]")))
search_box = driver.find_element(By.XPATH, "//input[contains(@placeholder, 'Search')]")
search_box.clear()
search_box.send_keys(full_name)
search_box.send_keys(Keys.ENTER)

# ---------- Step 3: Try “View Full Profile” Card ----------
profile_found = False
try:
    view_profile_btn = wait.until(
        EC.presence_of_element_located((By.XPATH, "//span[text()='View full profile']/ancestor::a"))
    )
    profile_url = view_profile_btn.get_attribute("href")
    driver.get(profile_url)
    profile_found = True
    print("✅ Case 1: Opened direct profile card.")
except:
    print("⚠️ Case 1 failed: No direct card. Trying first result name click...")

# ---------- Step 4: Fallback – Click First Result Name ----------
if not profile_found:
    try:
        content_blocks = driver.find_elements(By.XPATH, "//ul[contains(@class, 'list-style-none')]")

        print(f"🔎 Found {len(content_blocks)} content block(s)")

        for idx, block in enumerate(content_blocks):
            print(f"\n📦 Block #{idx+1}")
            links = block.find_elements(By.TAG_NAME, "a")
            for link in links:
                href = link.get_attribute("href")
                text = link.text.strip()
                print(f"🔗 Link Text: {text} | HREF: {href}")
                if href and "/in/" in href:
                    print("✅ Found valid profile link. Clicking...")
                    driver.execute_script("arguments[0].scrollIntoView(true);", link)
                    driver.execute_script("arguments[0].click();", link)
                    profile_found = True
                    raise StopIteration  # Break out of both loops

        if not profile_found:
            print("❌ No valid profile link found in any content block.")
            driver.quit()
            exit()

    except StopIteration:
        pass
    except Exception as e:
        print("❌ Could not open any profile:", str(e))
        driver.quit()
        exit()

# ---------- Step 5: Extract Headline and Company ----------
try:
    headline_elem = wait.until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "div.text-body-medium.break-words"))
    )
    headline = headline_elem.text.strip()

    if " at " in headline.lower():
        company = headline.split(" at ")[-1]
    else:
        company = "Unknown"

    print(f"\n🔍 Profile: {full_name}")
    print(f"📝 Headline: {headline}")
    print(f"🏢 Company: {company}")

except Exception as e:
    print("❌ Failed to extract headline:", str(e))

# ---------- Cleanup ----------
driver.quit()
