# AIism CLI Quick Use

Use help:

```bash
aism help
aism help scan
```

Most common commands:

```bash
# Scan text directly
aism scan --text "In conclusion, it is important to note..."

# Scan from a file
aism scan --file ./input.txt
```

Machine-readable output:

```bash
aism scan --json --file ./input.txt
```
