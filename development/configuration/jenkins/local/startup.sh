#!/bin/bash

# Echo the Jenkins admin password
if [ -f /var/jenkins_home/secrets/initialAdminPassword ]; then
  echo "Initial Admin Password:"
  cat /var/jenkins_home/secrets/initialAdminPassword
else
  echo "Admin password file not found. Ensure the Jenkins container initializes properly."
fi

# Start Jenkins
exec /usr/bin/tini -- /usr/local/bin/jenkins.sh
