#!/usr/bin/env python3
"""
Extract authoritative assessment structure from ALT_SAFE_Assessment.html

Parses HTML and outputs structured JSON model with:
- sections[]
- question_items[] with question keys, text, response enums
- conditional_detail_blocks (checkbox items)
- conditional_logic (answer-driven visibility)
- technology_selector blocks (tech-driven branching)

Output: analytics/runtime/alt_safe_model_extracted.json

Usage:
    python tools/extract_alt_safe_model.py --input <path_to_html> --output <output_path>
    
If no path provided, searches common locations.
"""

import json
import os
import re
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from html.parser import HTMLParser
from html import unescape
from datetime import datetime
from collections import defaultdict

# Rejected prompt patterns (case-insensitive)
REJECTED_PROMPTS = {'yes', 'no', 'n/a', 'n_a', 'na', 'y', 'n'}

def is_valid_prompt(text: str) -> bool:
    """Check if text is a valid question prompt (not a radio option)."""
    if not text:
        return False
    
    text_clean = text.strip().lower()
    
    # Reject if too short
    if len(text_clean) < 6:
        return False
    
    # Reject if matches rejected patterns
    if text_clean in REJECTED_PROMPTS:
        return False
    
    return True

class ALT_SAFE_Parser(HTMLParser):
    """Parser for ALT_SAFE_Assessment.html structure with improved prompt extraction."""
    
    def __init__(self):
        super().__init__()
        self.sections: List[Dict[str, Any]] = []
        self.current_section: Optional[Dict[str, Any]] = None
        self.current_question: Optional[Dict[str, Any]] = None
        self.current_detail_block: Optional[Dict[str, Any]] = None
        self.current_tech_selector: Optional[Dict[str, Any]] = None
        self.stack: List[str] = []
        self.in_form = False
        self.in_input = False
        self.current_input: Optional[Dict[str, Any]] = None
        self.current_label_text: str = ''
        self.pending_text: str = ''
        self.in_label = False
        self.in_option = False
        self.in_legend = False
        self.in_fieldset = False
        self.in_question_container = False  # div/span with class containing "question"
        self.question_labels: Dict[str, str] = {}  # Maps input name/id to label text
        self.fieldset_legends: Dict[str, str] = {}  # Maps fieldset to legend text
        self.prompt_diagnostics: List[Dict[str, Any]] = []  # Track extraction rules used
        
        # Track text accumulation for question containers
        self.question_container_text: List[str] = []
        self.current_question_name: Optional[str] = None
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        self.stack.append(tag)
        self.pending_text = ''
        
        # Track fieldset/legend (common pattern for question grouping)
        if tag == 'fieldset':
            self.in_fieldset = True
            fieldset_id = attrs_dict.get('id', '')
            if fieldset_id:
                self.current_question_name = fieldset_id
        elif tag == 'legend':
            self.in_legend = True
        
        # Track question containers (div/span with "question" in class)
        if tag in ('div', 'span', 'p'):
            class_attr = attrs_dict.get('class', '').lower()
            if 'question' in class_attr or 'prompt' in class_attr:
                self.in_question_container = True
                self.question_container_text = []
        
        # Track labels
        if tag == 'label':
            self.in_label = True
            label_for = attrs_dict.get('for', '')
            if label_for:
                self.current_label_text = label_for
        
        # Track form elements
        if tag == 'form':
            self.in_form = True
        elif tag == 'input':
            self.in_input = True
            input_type = attrs_dict.get('type', '').lower()
            input_name = attrs_dict.get('name', '')
            input_id = attrs_dict.get('id', '')
            input_value = attrs_dict.get('value', '')
            
            # Primary question (radio: YES/NO/N/A)
            if input_type == 'radio' and input_name:
                if not self.current_question or self.current_question.get('question_key') != input_name:
                    if self.current_question:
                        self._finalize_question()
                    
                    # Extract prompt using precedence rules
                    prompt_text, rule_used = self._extract_question_prompt(input_name, input_id)
                    
                    self.current_question = {
                        'question_key': input_name,
                        'question_text': prompt_text,
                        'response_enum': ['YES', 'NO', 'N_A'],
                        'conditional_detail_blocks': [],
                        'conditional_logic': {},
                        'technology_selectors': [],
                        'input_ids': [],
                        'extraction_rule': rule_used
                    }
                    if input_id:
                        self.current_question['input_ids'].append(input_id)
                    
                    # Record diagnostics
                    self.prompt_diagnostics.append({
                        'question_key': input_name,
                        'extracted_prompt': prompt_text,
                        'rule_used': rule_used,
                        'is_valid': is_valid_prompt(prompt_text)
                    })
                
                self.current_input = {
                    'type': 'radio',
                    'name': input_name,
                    'id': input_id,
                    'value': input_value
                }
            
            # Detail checkbox (conditional evidence)
            elif input_type == 'checkbox' and input_id:
                if not self.current_detail_block:
                    self.current_detail_block = {
                        'block_id': input_id,
                        'items': []
                    }
                self.current_detail_block['items'].append({
                    'item_id': input_id,
                    'label': '',  # Will be filled from label
                    'value': input_value
                })
        
        elif tag == 'select':
            selector_id = attrs_dict.get('id', '') or attrs_dict.get('name', '')
            if selector_id:
                self.current_tech_selector = {
                    'selector_id': selector_id,
                    'selector_label': self.question_labels.get(selector_id, ''),
                    'options': [],
                    'dependent_questions': [],
                    'dependent_detail_items': []
                }
        
        elif tag == 'option':
            self.in_option = True
            if self.current_tech_selector:
                option_value = attrs_dict.get('value', '')
                self.current_tech_selector['options'].append({
                    'value': option_value,
                    'label': ''  # Will be filled from text content
                })
        
        # Section headers
        elif tag in ('h1', 'h2', 'h3', 'h4'):
            if self.current_section:
                self._finalize_section()
            section_title = ''
            # Will be filled from text content
            self.current_section = {
                'section_key': attrs_dict.get('id', '') or f"section_{len(self.sections)}",
                'section_title': section_title,
                'question_items': []
            }
    
    def handle_endtag(self, tag):
        if self.stack:
            self.stack.pop()
        
        if tag == 'label':
            self.in_label = False
            self.current_label_text = ''
        elif tag == 'legend':
            self.in_legend = False
        elif tag == 'fieldset':
            self.in_fieldset = False
            self.current_question_name = None
        elif tag in ('div', 'span', 'p'):
            if self.in_question_container:
                self.in_question_container = False
                # Store accumulated text if we have a current question
                if self.current_question and self.question_container_text:
                    container_text = ' '.join(self.question_container_text).strip()
                    if is_valid_prompt(container_text):
                        if not self.current_question.get('question_text') or not is_valid_prompt(self.current_question['question_text']):
                            self.current_question['question_text'] = container_text
                            self.current_question['extraction_rule'] = 'question_container'
                self.question_container_text = []
        elif tag == 'option':
            self.in_option = False
        elif tag == 'form':
            self.in_form = False
        elif tag == 'input':
            self.in_input = False
            self.current_input = None
        elif tag in ('h1', 'h2', 'h3', 'h4'):
            if self.current_section and self.current_question:
                self._finalize_question()
        elif tag == 'section' or tag == 'div':
            if self.current_detail_block:
                if self.current_question:
                    self.current_question['conditional_detail_blocks'].append(self.current_detail_block)
                self.current_detail_block = None
    
    def handle_data(self, data):
        text = unescape(data.strip())
        if not text:
            return
        
        # Rule 1: Fieldset legend (highest priority for question grouping)
        if self.in_legend and self.in_fieldset:
            if self.current_question_name:
                self.fieldset_legends[self.current_question_name] = text
            # If we have a current question and this is valid, use it
            if self.current_question and is_valid_prompt(text):
                if not self.current_question.get('question_text') or not is_valid_prompt(self.current_question['question_text']):
                    self.current_question['question_text'] = text
                    self.current_question['extraction_rule'] = 'fieldset_legend'
        
        # Rule 2: Question container text
        if self.in_question_container:
            self.question_container_text.append(text)
        
        # Rule 3: Label text (but only if it's not a radio option label)
        if self.in_label:
            # Check if this label is for a radio button
            is_radio_label = False
            if self.current_input and self.current_input.get('type') == 'radio':
                is_radio_label = True
            
            # Only use label if it's NOT a radio option and is valid
            if not is_radio_label and is_valid_prompt(text):
                if self.current_label_text:
                    self.question_labels[self.current_label_text] = text
                # If we have a current question and no prompt yet, use this
                if self.current_question and not self.current_question.get('question_text'):
                    self.current_question['question_text'] = text
                    self.current_question['extraction_rule'] = 'label_non_radio'
        
        # Rule 4: Section title as fallback
        if self.current_section and not self.current_section.get('section_title'):
            if len(text) > 3:
                self.current_section['section_title'] = text
                # Use as question prompt fallback if question has no prompt
                if self.current_question and (not self.current_question.get('question_text') or not is_valid_prompt(self.current_question['question_text'])):
                    if is_valid_prompt(text):
                        self.current_question['question_text'] = text
                        self.current_question['extraction_rule'] = 'section_title_fallback'
        
        # Fill detail item labels
        if self.current_detail_block and self.current_detail_block['items']:
            last_item = self.current_detail_block['items'][-1]
            if not last_item.get('label'):
                last_item['label'] = text
        
        # Fill tech selector option labels
        if self.in_option and self.current_tech_selector and self.current_tech_selector['options']:
            last_option = self.current_tech_selector['options'][-1]
            if not last_option.get('label'):
                last_option['label'] = text
    
    def _extract_question_prompt(self, question_key: str, input_id: str) -> Tuple[str, str]:
        """
        Extract question prompt using precedence rules.
        
        Returns: (prompt_text, rule_used)
        """
        # Rule 1: Fieldset legend (if fieldset exists for this question)
        if self.current_question_name and self.current_question_name in self.fieldset_legends:
            legend_text = self.fieldset_legends[self.current_question_name]
            if is_valid_prompt(legend_text):
                return legend_text, 'fieldset_legend'
        
        # Rule 2: Label text (non-radio labels)
        label_text = self.question_labels.get(input_id, '') or self.question_labels.get(question_key, '')
        if label_text and is_valid_prompt(label_text):
            return label_text, 'label_non_radio'
        
        # Rule 3: Section title (fallback)
        if self.current_section and self.current_section.get('section_title'):
            section_title = self.current_section['section_title']
            if is_valid_prompt(section_title):
                return section_title, 'section_title_fallback'
        
        # Rule 4: Empty (will be filled from data handler)
        return '', 'pending'
    
    def _finalize_question(self):
        """Finalize current question and add to section."""
        if self.current_question and self.current_section:
            # If question text is still invalid, try to get from section title
            if not self.current_question.get('question_text') or not is_valid_prompt(self.current_question['question_text']):
                if self.current_section.get('section_title') and is_valid_prompt(self.current_section['section_title']):
                    self.current_question['question_text'] = self.current_section['section_title']
                    self.current_question['extraction_rule'] = 'section_title_final_fallback'
            
            # Detect conditional logic (e.g., show details when YES)
            if self.current_question['conditional_detail_blocks']:
                self.current_question['conditional_logic'] = {
                    'show_details_when': 'YES',  # Default assumption
                    'trigger_answer': 'YES'
                }
            
            # Add tech selector if present
            if self.current_tech_selector:
                self.current_question['technology_selectors'].append(self.current_tech_selector)
                self.current_tech_selector = None
            
            self.current_section['question_items'].append(self.current_question)
            self.current_question = None
    
    def _finalize_section(self):
        """Finalize current section."""
        if self.current_section:
            if self.current_question:
                self._finalize_question()
            self.sections.append(self.current_section)
            self.current_section = None
    
    def get_model(self) -> Dict[str, Any]:
        """Get extracted model structure."""
        if self.current_section:
            self._finalize_section()
        
        return {
            'metadata': {
                'extracted_at': datetime.utcnow().isoformat() + 'Z',
                'source': 'ALT_SAFE_Assessment.html',
                'version': '2.0',
                'total_sections': len(self.sections),
                'total_questions': sum(len(s.get('question_items', [])) for s in self.sections)
            },
            'sections': self.sections,
            'extraction_diagnostics': {
                'prompt_extraction': self.prompt_diagnostics,
                'usable_prompt_count': sum(1 for d in self.prompt_diagnostics if d['is_valid']),
                'invalid_prompt_count': sum(1 for d in self.prompt_diagnostics if not d['is_valid'])
            }
        }


def extract_from_html(html_path: str) -> Dict[str, Any]:
    """Extract assessment model from HTML file."""
    if not os.path.exists(html_path):
        raise FileNotFoundError(f"HTML file not found: {html_path}")
    
    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    parser = ALT_SAFE_Parser()
    parser.feed(html_content)
    
    return parser.get_model()


def main():
    """Main execution."""
    parser = argparse.ArgumentParser(description='Extract ALT_SAFE assessment model from HTML')
    parser.add_argument('--input', help='Path to ALT_SAFE_Assessment.html')
    parser.add_argument('--output', help='Output JSON path (default: analytics/runtime/alt_safe_model_extracted.json)')
    
    args = parser.parse_args()
    
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    # Determine input path
    if args.input:
        html_path = args.input
        if not os.path.exists(html_path):
            print(f"ERROR: File not found: {html_path}")
            sys.exit(1)
    else:
        # Look for HTML file in common locations
        # Use PSA_SYSTEM_ROOT or default to PSA System location
        psa_root = Path(os.environ.get('PSA_SYSTEM_ROOT', r'D:\PSA_System'))
        possible_paths = [
            project_root / 'ALT_SAFE_Assessment.html',
            project_root / 'public' / 'ALT_SAFE_Assessment.html',
            project_root / 'docs' / 'ALT_SAFE_Assessment.html',
            project_root / 'analytics' / 'ALT_SAFE_Assessment.html',
            project_root / 'tools' / 'ALT_SAFE_Assessment.html',
            # Check PSA_SYSTEM_ROOT
            psa_root / 'ALT_SAFE_Assessment.html',
        ]
        
        html_path = None
        for path in possible_paths:
            if path.exists():
                html_path = str(path)
                break
        
        if not html_path:
            print("ERROR: ALT_SAFE_Assessment.html not found in expected locations:")
            for path in possible_paths:
                print(f"  - {path}")
            print("\nPlease provide the path using --input")
            print("Usage: python tools/extract_alt_safe_model.py --input <path_to_html>")
            sys.exit(1)
    
    print(f"Extracting from: {html_path}")
    
    try:
        model = extract_from_html(html_path)
        
        # Determine output path
        if args.output:
            output_path = Path(args.output)
        else:
            output_dir = project_root / 'analytics' / 'runtime'
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / 'alt_safe_model_extracted.json'
        
        # Write main model
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(model, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Extracted model written to: {output_path}")
        print(f"  Sections: {len(model['sections'])}")
        total_questions = sum(len(s.get('question_items', [])) for s in model['sections'])
        print(f"  Total questions: {total_questions}")
        
        # Write diagnostics
        diagnostics_path = project_root / 'analytics' / 'reports' / 'alt_safe_extraction_prompt_diagnostics.json'
        diagnostics_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(diagnostics_path, 'w', encoding='utf-8') as f:
            json.dump(model['extraction_diagnostics'], f, indent=2, ensure_ascii=False)
        
        print(f"✓ Diagnostics written to: {diagnostics_path}")
        
        usable_count = model['extraction_diagnostics']['usable_prompt_count']
        invalid_count = model['extraction_diagnostics']['invalid_prompt_count']
        
        print(f"  Usable prompts: {usable_count}")
        print(f"  Invalid prompts: {invalid_count}")
        
        # Hard fail if usable prompts < 30
        if usable_count < 30:
            print(f"\n❌ ERROR: Usable prompt count ({usable_count}) is less than 30")
            print("   Extraction needs improvement before proceeding.")
            sys.exit(1)
        
        print(f"\n✅ Extraction successful: {usable_count} usable prompts")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
