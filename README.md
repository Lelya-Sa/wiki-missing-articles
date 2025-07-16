# Wiki Missing Articles Tool

## Project Overview
The **Wiki Missing Articles** tool helps Wikipedia contributors identify and prioritize important articles that are missing from a target language.  
The tool supports multilingual content enrichment and encourages cross-language collaboration within the Wikipedia community.

## Features
- Automatically detects missing articles between selected source and target languages
- Provides a ranked list of missing articles based on key factors:
    - Popularity (page views)
    - Number of languages
    - Incoming/outgoing links
    - References
    - Edits and templates
- Simple and intuitive user interface
- Responsive design (works on multiple screen sizes)

## Supported Languages
The current tool interface is available in the following languages:  
**en, ar, es, fr, he, hi, ru, zh**

## Technologies Used
- **Python** - backend logic
- **Django** - web framework
- **HTML & JavaScript** - frontend structure and dynamic behavior
- **Toolforge** - hosting environment
- **Wikimedia API** - data source (JSON format)
- **MediaWiki** - content structure compatibility

## Installation
The tool is hosted on **Toolforge**.  
For local testing or development:
1. Clone the project repository (GitHub).
2. Install required dependencies:
    - Python 3.x
    - Django
    - HTML / JavaScript files
3. Run the Django application locally.
4. Configure API settings as needed (no local database required — uses live Wikimedia API).

## Usage
1. Select target language and source language.
2. Enter a category.
3. Submit the request.
4. View ranked list of missing articles with direct links to existing articles in the source language.
5. Use the links to contribute to Wikipedia by creating or translating missing articles.

## Deployment
The tool is deployed and runs on **Toolforge**.
Live version: https://multilingual-missing-articles.toolforge.org/


## Team
- **Malak Atshi**
- **Leyla Salman**
- **Layla Assy**
- **Elie Memmi**
- **Joseph Mechaly**

## License
Open source — for educational and non-commercial use.

