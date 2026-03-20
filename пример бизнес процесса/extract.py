import docx
import os

def extract_text():
    files = [f for f in os.listdir('.') if f.endswith('.docx')]
    result = ''
    for f in files:
        try:
            doc = docx.Document(f)
            result += f'\n\n--- FILE: {f} ---\n'
            result += '\n'.join([p.text for p in doc.paragraphs])
        except Exception as e:
            result += f'\n\n--- ERROR READING FILE: {f} ---\n{str(e)}'
    
    with open('samples_text.txt', 'w', encoding='utf-8') as out:
        out.write(result)

if __name__ == '__main__':
    extract_text()
