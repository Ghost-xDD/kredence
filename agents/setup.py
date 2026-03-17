from setuptools import find_packages, setup

setup(
    name="agents",
    version="0.1.0",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "openai>=1.0.0",
        "pydantic>=2.0.0",
        "jinja2>=3.1.0",
        "httpx>=0.28.0",
        "python-dotenv>=1.0.0",
    ],
)
