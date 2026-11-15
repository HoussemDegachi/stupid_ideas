"""Package the extension as a .vsix without Node/vsce.

    py vscode-gastroscript/build_vsix.py
    code --install-extension vscode-gastroscript/gastroscript-0.1.0.vsix

A .vsix is a zip: [Content_Types].xml + extension.vsixmanifest + extension/<files>.
The repo's gastric.py is bundled so the installed extension works in any folder.
"""
import json
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
GASTRIC = HERE.parent / "gastric.py"
FILES = ["package.json", "extension.js", "language-configuration.json", "README.md",
         "syntaxes/gastroscript.tmLanguage.json", "media/stomach.js", "media/stomach.css", "icons/gs.svg"]
MIME = {".json": "application/json", ".js": "application/javascript", ".css": "text/css",
        ".md": "text/markdown", ".svg": "image/svg+xml", ".py": "text/x-python", ".vsixmanifest": "text/xml"}


def main():
    pkg = json.loads((HERE / "package.json").read_text(encoding="utf-8"))
    out = HERE / f"{pkg['name']}-{pkg['version']}.vsix"

    entries = {f"extension/{f}": (HERE / f).read_bytes() for f in FILES}
    entries["extension/gastric.py"] = GASTRIC.read_bytes()

    manifest = f"""<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="{pkg['name']}" Version="{pkg['version']}" Publisher="{pkg['publisher']}" />
    <DisplayName>{escape(pkg['displayName'])}</DisplayName>
    <Description xml:space="preserve">{escape(pkg['description'])}</Description>
    <Categories>{escape(','.join(pkg['categories']))}</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{pkg['engines']['vscode']}" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code" />
  </Installation>
  <Dependencies />
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
  </Assets>
</PackageManifest>
"""
    exts = sorted({Path(n).suffix for n in entries} | {".vsixmanifest"})
    types = "".join(f'<Default Extension="{e}" ContentType="{MIME[e]}" />' for e in exts)
    content_types = ('<?xml version="1.0" encoding="utf-8"?>'
                     f'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">{types}</Types>')

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("extension.vsixmanifest", manifest)
        for name, data in entries.items():
            z.writestr(name, data)
    print(f"built {out}")


if __name__ == "__main__":
    main()
