#!/usr/bin/env bash
# APK'ni Android Gradle'siz yig'ish: aapt2 + javac + dx + apksig.
# TOOLS papkasida: aapt2, android.jar (resources.arsc), all.jar (framework klasslari), dx.jar, apksig.jar
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
TOOLS="${TOOLS:-$ROOT/../android-tools}"
OUT="$ROOT/build"; A="$ROOT/android"
rm -rf "$OUT"; mkdir -p "$OUT"/{res,gen,classes,dex}

"$TOOLS/aapt2" compile --dir "$A/res" -o "$OUT/res/res.zip"
# Ilova fayllari; API_URL berilsa ilova shu serverga ulanadi (aks holda oflayn rejim)
cp -r "$ROOT/web" "$OUT/assets"
[ -n "${API_URL:-}" ] && echo "window.SAYOHATCHI_API = \"$API_URL\";" > "$OUT/assets/config.js"
"$TOOLS/aapt2" link -I "$TOOLS/android.jar" --manifest "$A/AndroidManifest.xml" -A "$OUT/assets" \
  --java "$OUT/gen" -o "$OUT/unsigned.apk" "$OUT/res/res.zip"

javac -nowarn --release 8 -cp "$TOOLS/all.jar" -d "$OUT/classes" \
  $(find "$A/src" "$OUT/gen" -name '*.java') 2>&1 | grep -v JAVA_TOOL || true
# dx 1.7 faqat Java 6 (50) klasslarini qabul qiladi; kodda Java 8 xususiyatlari ishlatilmagan
find "$OUT/classes" -name '*.class' -exec python3 -c 'import sys
for f in sys.argv[1:]:
    b=bytearray(open(f,"rb").read()); b[6:8]=b"\x00\x32"; open(f,"wb").write(b)' {} +
java -cp "$TOOLS/dx.jar" com.android.dx.command.Main --dex --output="$OUT/dex/classes.dex" "$OUT/classes" 2>&1 | grep -v JAVA_TOOL || true
(cd "$OUT/dex" && zip -q "$OUT/unsigned.apk" classes.dex)

KS="$A/debug.p12"
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storetype PKCS12 -storepass sayohatchi -keypass sayohatchi \
  -alias sayohatchi -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Sayohatchi AI, O=Sayohatchi, C=UZ" 2>&1 | grep -v JAVA_TOOL || true
javac -nowarn -cp "$TOOLS/apksig.jar" -d "$OUT/signer" "$A/Signer.java" 2>&1 | grep -v JAVA_TOOL || true
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED -cp "$TOOLS/apksig.jar:$OUT/signer" Signer "$KS" sayohatchi sayohatchi "$OUT/unsigned.apk" "$ROOT/Sayohatchi-AI.apk" 2>&1 | grep -v JAVA_TOOL || true
ls -la "$ROOT/Sayohatchi-AI.apk"
