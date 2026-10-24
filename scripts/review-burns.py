"""Compatibility entry point: scan burns and eTAO together with reviewed metadata."""
import runpy
from pathlib import Path

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('review-chain-news.py')), run_name='__main__')
