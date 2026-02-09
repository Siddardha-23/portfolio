# Stage 1: Build
FROM ubuntu:20.04 as builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y && \
    apt-get install -y python3 python3-pip

COPY ./app /app
WORKDIR /app
RUN pip3 install -r requirements.txt

# Stage 2: Final image
FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y && \
    apt-get install -y nginx supervisor && \
    rm -rf /var/lib/apt/lists/*

# Copy the application from the builder stage
COPY --from=builder /app /app
COPY --from=builder /usr/local/lib/python3.8/dist-packages /usr/local/lib/python3.8/dist-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Setup nginx
RUN rm /etc/nginx/sites-enabled/default
COPY nginx/flask_chatbot.conf /etc/nginx/sites-available/
RUN ln -s /etc/nginx/sites-available/flask_chatbot.conf /etc/nginx/sites-enabled/flask_chatbot.conf && \
    echo "daemon off;" >> /etc/nginx/nginx.conf && \
    mkdir -p /var/log/supervisor 

COPY nginx/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY nginx/gunicorn.conf /etc/supervisor/conf.d/gunicorn.conf
# # Gunicorn default configuration
COPY nginx/gunicorn.config.py /app/gunicorn.config.py

WORKDIR /app

EXPOSE 80

# Start processes
CMD ["/usr/bin/supervisord"]
