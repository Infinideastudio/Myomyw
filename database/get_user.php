<?php
	require_once('config.php');
	require_once('tool.php');
	$db=mysqli_connect('localhost',$db_user,$db_passwd);
	$uuid=$_REQUEST['uuid'];
	if(!$db){
		echo json_encode(array("error_code"=>99));
		return;
	}
	if(!chkuuid($uuid)){
		echo json_encode(array("error_code"=>98));
		return;
	}
	mysqli_select_db( $db,$db_name);
	$sql='select * from user where uuid='."'$uuid'";
	$ret=mysqli_query($db,$sql);
	if($ret->num_rows == 0){
		echo json_encode(array("error_code"=>1));
		return;
	}
	$row = mysqli_fetch_array($ret);
	$sql='select * from user where rating>'.$row['rating'];
	$ret1=mysqli_query($db,$sql);
	echo json_encode(array("username"=>$row['username'],"rating"=>$row['rating'],"ranking"=>$ret1->num_rows+1,"error_code"=>0));
	return;
?>
