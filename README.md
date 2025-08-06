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
To run the project locally on your machine using the Windows Command Prompt (CMD), follow these steps:

Make sure you have Python 3.11 installed on your system.

1. Clone the GitHub repository:
git clone https://github.com/Lelya-Sa/wiki-missing-articles.git
2. Enter the project directory:
cd wiki-missing-articles
3. Install all required dependencies:
pip install -r requirements.txt
4. Collect static files:
python manage.py collectstatic
5. Run the local server:
python manage.py runserver

After this steps you can now access the tool in your browser at:
http://127.0.0.1:8000/


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

