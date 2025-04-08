# Use the official Jenkins LTS image with JDK 17
FROM jenkins/jenkins:lts-jdk17

# Switch to root for permission changes
USER root

# Copy the startup script into the container
COPY startup.sh /usr/local/bin/startup.sh

# Set permissions and make the script executable
RUN chmod +x /usr/local/bin/startup.sh

# Switch back to the Jenkins user
USER jenkins

# Use the startup script as the entry point
CMD ["startup.sh"]
