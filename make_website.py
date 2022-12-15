import re
import shutil
from itertools import chain
from pathlib import Path

from markdown import markdown

out = Path('out')
if out.exists():
    shutil.rmtree(out)

# Examen
exam_web_path = Path("examen", "web")
shutil.copytree(exam_web_path, out / "examen")

# T1
t2 = Path("t2").resolve()
for file in chain(t2.iterdir(), (t2 / "visualization").iterdir(), (t2 / "data").iterdir()):
    if file.suffix in (".css", ".html", ".js", ".csv"):
        print(file)
        out_path = out / "t2" / file.relative_to(t2)
        if not out_path.parent.exists():
            out_path.parent.mkdir(exist_ok=True, parents=True)
        shutil.copyfile(file, out_path)

# T3
t3_web_path = Path("t3", "bonus")
shutil.copytree(t3_web_path, out / "t3")


# Index
base_html_raw = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Index</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/2.10.0/github-markdown.min.css">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body class="markdown-body">{}</body>
"""
base_html = re.sub(r"\s+", " ", base_html_raw)

with Path("readme.md").open() as f:
    html = markdown(f.read())
    Path("out", "index.html").write_text(base_html.format(html))
