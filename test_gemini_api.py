#!/usr/bin/env python3
"""
Test script to diagnose Gemini API configuration issues
Run this on your Azure VM to verify the API key is loaded correctly
"""

import os
import sys

print("=== Gemini API Diagnostic Test ===\n")

# Step 1: Check if GEMINI_API_KEY environment variable is set
gemini_key = os.getenv("GEMINI_API_KEY")
print(f"1. GEMINI_API_KEY environment variable:")
if gemini_key:
    print(f"   ✓ Found: {gemini_key[:10]}...{gemini_key[-4:]}")
    print(f"   ✓ Length: {len(gemini_key)} characters")
else:
    print("   ✗ NOT FOUND - Environment variable is not set!")
    sys.exit(1)

# Step 2: Try to import google.generativeai
print("\n2. Importing google.generativeai:")
try:
    import google.generativeai as genai
    print("   ✓ Successfully imported")
except Exception as e:
    print(f"   ✗ Failed to import: {e}")
    sys.exit(1)

# Step 3: Try to configure genai with the API key
print("\n3. Configuring Gemini API:")
try:
    genai.configure(api_key=gemini_key)
    print("   ✓ API configured successfully")
except Exception as e:
    print(f"   ✗ Failed to configure: {e}")
    sys.exit(1)

# Step 4: Try to create a model and generate content
print("\n4. Testing content generation:")
try:
    model = genai.GenerativeModel("gemini-2.0-flash-exp")
    print("   ✓ Model created successfully")
    
    response = model.generate_content(
        "Say 'Hello World' in one word",
        generation_config=genai.types.GenerationConfig(
            temperature=0.1,
            max_output_tokens=10,
        )
    )
    print(f"   ✓ Content generated: {response.text.strip()}")
except Exception as e:
    import traceback
    print(f"   ✗ Failed to generate content: {e}")
    print(f"\nFull traceback:")
    print(traceback.format_exc())
    sys.exit(1)

print("\n=== ALL TESTS PASSED ✓ ===")
print("\nThe Gemini API is working correctly!")
print("If you still see errors in your application, the issue is likely with:")
print("  1. Environment variables not being passed to PM2")
print("  2. PM2 not restarting the application after setting environment variables")
print("\nSuggested fixes:")
print("  1. Set environment variable in PM2 ecosystem file")
print("  2. Restart PM2: pm2 restart ask-expert-node")
print("  3. Check PM2 environment: pm2 env 0")
