result=1
make setup
while [ $result -ne 0 -a $result -ne 130  ]; do
    make prod
    result=$?
    sleep 30
done
