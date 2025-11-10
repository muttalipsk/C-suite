import requests
from bs4 import BeautifulSoup
from typing import Dict, List
from urllib.parse import urljoin, urlparse
import time

def scrape_company_website(company_url: str, max_pages: int = 5) -> Dict[str, any]:
    """
    Scrape company website to extract relevant information for generating MCQ questions.
    
    Args:
        company_url: The company website URL
        max_pages: Maximum number of pages to scrape (default: 5)
    
    Returns:
        Dict containing scraped data: company_info, about, team, culture, values, etc.
    """
    if not company_url or company_url.strip() == "":
        return {
            "error": "No company URL provided",
            "company_info": "",
            "about": "",
            "team": "",
            "culture": "",
            "values": "",
            "all_text": ""
        }
    
    try:
        # Normalize URL
        if not company_url.startswith(('http://', 'https://')):
            company_url = f'https://{company_url}'
        
        parsed_url = urlparse(company_url)
        base_domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        # Common paths to check
        paths_to_scrape = [
            "",  # Homepage
            "/about",
            "/about-us",
            "/team",
            "/our-team",
            "/culture",
            "/values",
            "/mission",
            "/company",
            "/who-we-are"
        ]
        
        scraped_data = {
            "company_info": "",
            "about": "",
            "team": "",
            "culture": "",
            "values": "",
            "all_text": ""
        }
        
        all_text_parts = []
        pages_scraped = 0
        
        for path in paths_to_scrape:
            if pages_scraped >= max_pages:
                break
            
            url = urljoin(base_domain, path)
            
            try:
                # Add headers to avoid being blocked
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
                
                response = requests.get(url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    soup = BeautifulSoup(response.content, 'html.parser')
                    
                    # Remove script and style elements
                    for script in soup(["script", "style", "nav", "footer", "header"]):
                        script.decompose()
                    
                    # Get text
                    text = soup.get_text(separator=' ', strip=True)
                    
                    # Clean up whitespace
                    lines = (line.strip() for line in text.splitlines())
                    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                    text = ' '.join(chunk for chunk in chunks if chunk)
                    
                    if len(text) > 100:  # Only add if meaningful content
                        all_text_parts.append(text)
                        pages_scraped += 1
                        
                        # Categorize based on path
                        if path == "":
                            scraped_data["company_info"] = text[:2000]  # Limit to 2000 chars
                        elif "about" in path.lower():
                            scraped_data["about"] = text[:2000]
                        elif "team" in path.lower():
                            scraped_data["team"] = text[:2000]
                        elif "culture" in path.lower() or "values" in path.lower():
                            scraped_data["culture"] = text[:2000]
                        elif "mission" in path.lower():
                            scraped_data["values"] = text[:2000]
                
                # Be polite - don't hammer the server
                time.sleep(0.5)
                
            except requests.exceptions.RequestException:
                # Skip this path if it fails
                continue
        
        # Combine all text
        scraped_data["all_text"] = ' '.join(all_text_parts)[:10000]  # Limit to 10k chars total
        
        if not scraped_data["all_text"]:
            scraped_data["error"] = "No content could be extracted from the website"
        
        return scraped_data
        
    except Exception as e:
        return {
            "error": str(e),
            "company_info": "",
            "about": "",
            "team": "",
            "culture": "",
            "values": "",
            "all_text": ""
        }


def extract_company_insights(scraped_data: Dict[str, str]) -> str:
    """
    Extract key insights from scraped company data to use in MCQ generation.
    
    Args:
        scraped_data: Dictionary containing scraped website content
    
    Returns:
        Formatted string with company insights
    """
    insights = []
    
    if scraped_data.get("company_info"):
        insights.append(f"Company Overview: {scraped_data['company_info'][:500]}")
    
    if scraped_data.get("about"):
        insights.append(f"About: {scraped_data['about'][:500]}")
    
    if scraped_data.get("team"):
        insights.append(f"Team: {scraped_data['team'][:500]}")
    
    if scraped_data.get("culture"):
        insights.append(f"Culture/Values: {scraped_data['culture'][:500]}")
    
    if scraped_data.get("values"):
        insights.append(f"Mission: {scraped_data['values'][:500]}")
    
    return "\n\n".join(insights) if insights else scraped_data.get("all_text", "")[:2000]
