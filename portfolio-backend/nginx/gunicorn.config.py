import multiprocessing

"""Gunicorn configuration."""

bind = '127.0.0.1:5000'

# workers = (2 * multiprocessing.cpu_count()) + 1
workers = 1
worker_class = 'gevent'

timeout = 120
accesslog = '-'